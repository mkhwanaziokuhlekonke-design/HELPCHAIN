/**
 * AdminActivityMap — admin-only live activity map.
 *
 * Renders a Leaflet map showing three live layers:
 *  • Blue dot    → each online user's GPS position   (LocationContext)
 *  • Coloured pin → each geolocated help request      (HelpContext)
 *      red pulsing   = emergency
 *      amber         = open
 *      teal          = accepted / in-progress
 *      grey          = completed
 *  • Gold 🎁 pin  → donor's location at time of donation (DonationContext)
 *
 * All layers update via postMessage / injectJavaScript without re-mounting.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Platform, View, StyleSheet } from "react-native";
import { useLocation } from "@/context/LocationContext";
import { useHelp, HelpRequest } from "@/context/HelpContext";
import { useDonations } from "@/context/DonationContext";
import { useEmergencyAlerts } from "@/context/EmergencyAlertContext";
import { WEST_ACRES_REFERENCE } from "@/constants/communityCenters";

// ── Helpers ───────────────────────────────────────────────────────────────────

const USER_COLOR = "#2563EB";

const CATEGORY_EMOJI: Record<string, string> = {
  emergency: "🚨",
  medical: "🏥",
  food: "🍎",
  transport: "🚗",
  daily: "🏠",
  other: "❓",
};

function requestFill(r: HelpRequest): string {
  if (r.isEmergency) return "#EF4444";
  if (r.status === "accepted") return "#14B8A6";
  if (r.status === "completed") return "#64748B";
  return "#F59E0B";
}

// ── Embedded Leaflet HTML ─────────────────────────────────────────────────────

const MAP_HTML = `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  html,body,#map{width:100%;height:100%;font-family:sans-serif;}
  @keyframes ring{0%{transform:scale(1);opacity:.8;}100%{transform:scale(2.4);opacity:0;}}
  .nodata{
    position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
    background:rgba(255,255,255,.9);padding:10px 18px;border-radius:10px;
    font-size:12px;color:#64748B;pointer-events:none;z-index:999;text-align:center;
  }
  .leaflet-popup-content-wrapper{border-radius:10px;box-shadow:0 4px 20px rgba(0,0,0,.15);}
  .leaflet-popup-content{margin:10px 14px;font-size:12px;line-height:1.5;}
</style>
</head>
<body>
<div id="map"></div>
<div id="nodata" class="nodata">Waiting for live data…</div>
<script>
var map = L.map('map',{zoomControl:true,attributionControl:false}).setView([${WEST_ACRES_REFERENCE.latitude},${WEST_ACRES_REFERENCE.longitude}],13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);

 var uMarkers={}, rMarkers={}, dMarkers={}, eMarkers={};
var hasView=false;
var nd=document.getElementById('nodata');
function hideND(){if(nd)nd.style.display='none';}

/* ── User markers (small blue dots) ── */
function renderUsers(users){
  Object.keys(uMarkers).forEach(function(uid){
    if(!users.find(function(u){return u.uid===uid;})){
      map.removeLayer(uMarkers[uid]);delete uMarkers[uid];
    }
  });
  users.forEach(function(u){
    if(uMarkers[u.uid]){
      uMarkers[u.uid].setLatLng([u.lat,u.lng]);
    } else {
      var icon=L.divIcon({
        className:'',
        html:'<div style="width:13px;height:13px;background:'+u.color+';border:2.5px solid #FFFFFF;border-radius:50%;box-shadow:0 1px 5px rgba(0,0,0,.35);"></div>',
        iconSize:[13,13],iconAnchor:[6,6]
      });
      uMarkers[u.uid]=L.marker([u.lat,u.lng],{icon:icon}).addTo(map)
        .bindPopup('<b>'+u.name+'</b><br><span style="color:#64748B;font-size:11px">Online · user</span>');
    }
    if(!hasView){map.setView([u.lat,u.lng],13);hasView=true;}
    hideND();
  });
}

/* ── Request markers (coloured pins by status) ── */
function renderRequests(reqs){
  Object.keys(rMarkers).forEach(function(id){
    if(!reqs.find(function(r){return r.id===id;})){
      map.removeLayer(rMarkers[id]);delete rMarkers[id];
    }
  });
  reqs.forEach(function(r){
    if(rMarkers[r.id]){
      rMarkers[r.id].setLatLng([r.lat,r.lng]);
    } else {
      var pulse=r.isEmergency
        ?'<div style="position:absolute;inset:-7px;border:2px solid #EF4444;border-radius:50%;animation:ring 1.4s ease-out infinite;"></div>'
        :'';
      var icon=L.divIcon({
        className:'',
        html:'<div style="position:relative;width:34px;height:34px;display:flex;align-items:center;justify-content:center;">'
          +pulse
          +'<div style="width:28px;height:28px;background:'+r.color+';border:2.5px solid #FFFFFF;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,.3);">'+r.emoji+'</div>'
          +'</div>',
        iconSize:[34,34],iconAnchor:[17,17]
      });
      rMarkers[r.id]=L.marker([r.lat,r.lng],{icon:icon,zIndexOffset:200}).addTo(map)
        .bindPopup('<b>'+r.title+'</b><br><span style="color:#64748B;font-size:11px">'+r.status.toUpperCase()+(r.isEmergency?' 🚨':'')+'</span>');
    }
    if(!hasView){map.setView([r.lat,r.lng],13);hasView=true;}
    hideND();
  });
}

/* ── Donation markers (gold gift pins) ── */
function renderDonations(donations){
  Object.keys(dMarkers).forEach(function(id){
    if(!donations.find(function(d){return d.id===id;})){
      map.removeLayer(dMarkers[id]);delete dMarkers[id];
    }
  });
  donations.forEach(function(d){
    if(dMarkers[d.id]){
      dMarkers[d.id].setLatLng([d.lat,d.lng]);
    } else {
      var icon=L.divIcon({
        className:'',
        html:'<div style="position:relative;width:34px;height:34px;display:flex;align-items:center;justify-content:center;">'
          +'<div style="width:28px;height:28px;background:#F59E0B;border:2.5px solid #FFFFFF;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:15px;box-shadow:0 2px 8px rgba(245,158,11,.5);">🎁</div>'
          +'</div>',
        iconSize:[34,34],iconAnchor:[17,17]
      });
      dMarkers[d.id]=L.marker([d.lat,d.lng],{icon:icon,zIndexOffset:150}).addTo(map)
        .bindPopup(
          '<b>'+d.donorName+'</b><br>'
          +'<span style="color:#64748B;font-size:11px">Donated '+d.quantity+'× '+d.itemType+'</span>'
          +(d.address?'<br><span style="color:#64748B;font-size:10px">'+d.address+'</span>':'')
        );
    }
    if(!hasView){map.setView([d.lat,d.lng],13);hasView=true;}
    hideND();
  });
}

 /* ── Emergency alert markers (pulsing red) ── */
 function renderEmergencies(alerts){
   Object.keys(eMarkers).forEach(function(id){
     if(!alerts.find(function(a){return a.id===id;})){
       map.removeLayer(eMarkers[id]);delete eMarkers[id];
     }
   });
   alerts.forEach(function(a){
     if(eMarkers[a.id]){
       eMarkers[a.id].setLatLng([a.lat,a.lng]);
     } else {
       var icon=L.divIcon({
         className:'',
         html:'<div style="position:relative;width:42px;height:42px;display:flex;align-items:center;justify-content:center;">'
           +'<div style="position:absolute;inset:-6px;border:2px solid #EF4444;border-radius:50%;animation:ring 1.1s ease-out infinite;"></div>'
           +'<div style="width:32px;height:32px;background:#EF4444;border:3px solid #FFFFFF;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 2px 10px rgba(220,38,38,.65);">🚨</div>'
           +'</div>',
         iconSize:[42,42],iconAnchor:[21,21]
       });
       eMarkers[a.id]=L.marker([a.lat,a.lng],{icon:icon,zIndexOffset:400}).addTo(map)
         .bindPopup(
           '<b style="color:#EF4444">EMERGENCY ALERT</b><br>'
           +'<b>'+a.userName+'</b><br>'
           +'<span style="color:#64748B;font-size:11px">Calling '+a.serviceName+' · '+a.serviceNumber+'</span>'
           +(a.address?'<br><span style="color:#64748B;font-size:10px">'+a.address+'</span>':'')
         );
     }
     if(!hasView){map.setView([a.lat,a.lng],14);hasView=true;}
     hideND();
   });
 }

/* ── Message dispatch ── */
function onMsg(data){
  if(!data)return;
  if(data.type==='UPDATE_LOCATIONS')renderUsers(data.users||[]);
  if(data.type==='UPDATE_REQUESTS')renderRequests(data.requests||[]);
  if(data.type==='UPDATE_DONATIONS')renderDonations(data.donations||[]);
   if(data.type==='UPDATE_EMERGENCIES')renderEmergencies(data.alerts||[]);
}
function handle(e){
  try{var d=typeof e.data==='string'?JSON.parse(e.data):e.data;onMsg(d);}catch(err){}
}
window.addEventListener('message',handle);
document.addEventListener('message',handle);
</script>
</body>
</html>`;

// ── React component ───────────────────────────────────────────────────────────

interface AdminActivityMapProps {
  height?: number;
}

export function AdminActivityMap({ height = 300 }: AdminActivityMapProps) {
  const { userLocations } = useLocation();
  const { requests } = useHelp();
  const { donations } = useDonations();
  const { emergencyAlerts } = useEmergencyAlerts();

  const iframeRef = useRef<any>(null);
  const webViewRef = useRef<any>(null);
  const [ready, setReady] = useState(false);

  // ── Payload builders ───────────────────────────────────────────────
  const locationPayload = useCallback(() => {
    const users = userLocations.map((u) => ({
      uid: u.uid,
      name: u.name,
      lat: u.latitude,
      lng: u.longitude,
      color: USER_COLOR,
    }));
    return JSON.stringify({ type: "UPDATE_LOCATIONS", users });
  }, [userLocations]);

  const requestsPayload = useCallback(() => {
    const reqs = requests
      .filter((r) => r.location && r.status !== "cancelled")
      .map((r) => ({
        id: r.id,
        title: r.title,
        lat: r.location!.latitude,
        lng: r.location!.longitude,
        color: requestFill(r),
        emoji: CATEGORY_EMOJI[r.category] ?? "❓",
        status: r.status,
        isEmergency: r.isEmergency,
      }));
    return JSON.stringify({ type: "UPDATE_REQUESTS", requests: reqs });
  }, [requests]);

  const donationsPayload = useCallback(() => {
    const items = donations
      .filter((d) => d.location)
      .map((d) => ({
        id: d.id,
        donorName: d.donorName,
        itemType: d.itemType,
        quantity: d.quantity,
        lat: d.location!.latitude,
        lng: d.location!.longitude,
        address: d.location?.address ?? "",
      }));
    return JSON.stringify({ type: "UPDATE_DONATIONS", donations: items });
  }, [donations]);

  const emergenciesPayload = useCallback(() => {
    const alerts = emergencyAlerts
      .filter((alert) => alert.location)
      .map((alert) => ({
        id: alert.id,
        userName: alert.userName,
        serviceName: alert.serviceName,
        serviceNumber: alert.serviceNumber,
        lat: alert.location!.latitude,
        lng: alert.location!.longitude,
        address: alert.location?.address ?? "",
      }));
    return JSON.stringify({ type: "UPDATE_EMERGENCIES", alerts });
  }, [emergencyAlerts]);

  // ── Push to embedded Leaflet ───────────────────────────────────────
  function push(payload: string) {
    if (Platform.OS === "web") {
      try {
        iframeRef.current?.contentWindow?.postMessage(payload, "*");
      } catch {}
    } else {
      const js = `
        try{
          var d=${payload};
          var e=new MessageEvent('message',{data:d});
          window.dispatchEvent(e);
          document.dispatchEvent(e);
        }catch(err){}
        true;
      `;
      webViewRef.current?.injectJavaScript(js);
    }
  }

  function onMapReady() {
    setReady(true);
    setTimeout(() => {
      push(locationPayload());
      push(requestsPayload());
      push(donationsPayload());
      push(emergenciesPayload());
    }, 350);
  }

  useEffect(() => { if (ready) push(locationPayload()); }, [userLocations, ready]);
  useEffect(() => { if (ready) push(requestsPayload()); }, [requests, ready]);
  useEffect(() => { if (ready) push(donationsPayload()); }, [donations, ready]);
  useEffect(() => { if (ready) push(emergenciesPayload()); }, [emergencyAlerts, ready]);

  // ── Web render (iframe) ────────────────────────────────────────────
  if (Platform.OS === "web") {
    return (
      <View style={[styles.container, { height }]}>
        <iframe
          ref={iframeRef}
          srcDoc={MAP_HTML}
          style={{ width: "100%", height: "100%", border: "none" } as any}
          title="Admin Live Activity Map"
          onLoad={onMapReady}
        />
      </View>
    );
  }

  // ── Native render (WebView) ────────────────────────────────────────
  const { WebView } = require("react-native-webview");
  return (
    <View style={[styles.container, { height }]}>
      <WebView
        ref={webViewRef}
        source={{ html: MAP_HTML }}
        onLoadEnd={onMapReady}
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={["*"]}
        style={{ flex: 1 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#DBEAFE",
  },
});
