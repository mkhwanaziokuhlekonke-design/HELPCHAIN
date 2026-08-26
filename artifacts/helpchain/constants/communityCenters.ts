export interface CommunityCenter {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  description: string;
}

export const WEST_ACRES_CENTERS: CommunityCenter[] = [
  {
    id: "communio-church-west-acres",
    name: "Communio Church",
    address: "Jacaranda Road, West Acres, Mbombela, 1200",
    latitude: -25.4804,
    longitude: 30.9618,
    description: "Church outreach and community support",
  },
  {
    id: "ng-kerk-westergloed",
    name: "NG Kerk Westergloed",
    address: "36 Koraalboom Avenue, West Acres Central, Mbombela, 1211",
    latitude: -25.47712,
    longitude: 30.95831,
    description: "Church community centre",
  },
];

export const WEST_ACRES_REFERENCE = {
  latitude: -25.4827667,
  longitude: 30.9538241,
};