export default function HelpChainLogo({ width = 320, showTagline = true }) {
  return (
    <div className="flex flex-col items-center">
      <svg
        width={width}
        viewBox="0 0 600 350"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="helpBlue" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2563EB" />
            <stop offset="100%" stopColor="#0F3FBF" />
          </linearGradient>

          <linearGradient id="helpTeal" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2DD4BF" />
            <stop offset="100%" stopColor="#14B8A6" />
          </linearGradient>
        </defs>

        {/* Left side heart */}
        <path
          d="
          M235 60
          C205 25 145 25 120 60
          C95 95 100 145 140 185
          L250 295
          "
          stroke="url(#helpBlue)"
          strokeWidth="34"
          fill="none"
          strokeLinecap="round"
        />

        {/* Right side heart */}
        <path
          d="
          M365 60
          C395 25 455 25 480 60
          C505 95 500 145 460 185
          L350 295
          "
          stroke="url(#helpTeal)"
          strokeWidth="34"
          fill="none"
          strokeLinecap="round"
        />

        {/* Handshake center */}
        <g transform="translate(300 165)">
          <path
            d="M-55 -15 L-10 -55 C0 -65 15 -65 25 -55 L55 -25"
            stroke="#2563EB"
            strokeWidth="18"
            fill="none"
            strokeLinecap="round"
          />

          <path
            d="M55 15 L10 55 C0 65 -15 65 -25 55 L-55 25"
            stroke="#14B8A6"
            strokeWidth="18"
            fill="none"
            strokeLinecap="round"
          />

          <line
            x1="-5"
            y1="-5"
            x2="18"
            y2="18"
            stroke="white"
            strokeWidth="6"
          />

          <line
            x1="-20"
            y1="10"
            x2="0"
            y2="30"
            stroke="white"
            strokeWidth="6"
          />

          <line
            x1="-35"
            y1="25"
            x2="-15"
            y2="45"
            stroke="white"
            strokeWidth="6"
          />
        </g>
      </svg>

      <h1
        className="font-bold leading-none"
        style={{
          fontSize: "4rem",
          marginTop: "-10px",
        }}
      >
        <span
          style={{
            color: "#2563EB",
          }}
        >
          Help
        </span>

        <span
          style={{
            color: "#14B8A6",
          }}
        >
          Chain
        </span>
      </h1>

      {showTagline && (
        <p
          style={{
            color: "#374151",
            fontSize: "1.4rem",
            marginTop: "8px",
          }}
        >
          Help together. Grow together.
        </p>
      )}
    </div>
  );
}
