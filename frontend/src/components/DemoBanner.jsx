import { DEMO } from "../lib/api.js";
import { resetDemo } from "../lib/demoApi.js";

/** Small notice shown only in the static demo build (VITE_DEMO=true). */
export default function DemoBanner() {
  if (!DEMO) return null;
  return (
    <div className="demo-banner" role="note">
      <span>
        <strong>Demo</strong>
        <span className="demo-hint"> · your tasks stay in this browser</span>
      </span>
      <button
        type="button"
        onClick={() => {
          resetDemo();
          window.location.assign("/today");
        }}
      >
        Reset
      </button>
      <a href="https://github.com/jinxbuilds/daybook" target="_blank" rel="noopener noreferrer">
        Source ↗
      </a>
    </div>
  );
}
