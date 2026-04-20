import { useEffect, useState } from "react";
import {
  fetchCollage,
  fetchRecentSubmissions,
  submitColor,
  type CollageResponse,
  type ColorSubmission
} from "./api";
import { ColorSpectrum, type SpectrumSelection } from "./components/ColorSpectrum";
import { RothkoCollage } from "./components/RothkoCollage";
import { useDeviceId } from "./hooks/useDeviceId";

const INITIAL_SELECTION: SpectrumSelection = {
  hexColor: "#D46A79",
  x: 0.12,
  y: 0.3
};

async function loadSessionFeed(sessionStartedAt: string) {
  const [nextCollage, nextRecent] = await Promise.all([
    fetchCollage(sessionStartedAt),
    fetchRecentSubmissions(sessionStartedAt)
  ]);

  return { nextCollage, nextRecent };
}

export default function App() {
  const deviceId = useDeviceId();
  const [sessionStartedAt] = useState(() => new Date().toISOString());
  const [selection, setSelection] = useState<SpectrumSelection>(INITIAL_SELECTION);
  const [collage, setCollage] = useState<CollageResponse | null>(null);
  const [recentSubmissions, setRecentSubmissions] = useState<ColorSubmission[]>([]);
  const [statusMessage, setStatusMessage] = useState("Choose the color that feels most true right now.");
  const [submitting, setSubmitting] = useState(false);

  async function refreshFeed() {
    const { nextCollage, nextRecent } = await loadSessionFeed(sessionStartedAt);
    setCollage(nextCollage);
    setRecentSubmissions(nextRecent);
  }

  useEffect(() => {
    void refreshFeed();

    const intervalId = window.setInterval(() => {
      void refreshFeed();
    }, 8000);

    return () => window.clearInterval(intervalId);
  }, [sessionStartedAt]);

  async function handleShare() {
    setSubmitting(true);

    try {
      const saved = await submitColor({
        deviceId,
        hexColor: selection.hexColor,
        x: selection.x,
        y: selection.y
      });

      setStatusMessage(`Shared ${saved.hexColor} at ${new Date(saved.createdAt).toLocaleTimeString()}.`);
      await refreshFeed();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to share your color.";
      setStatusMessage(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="app-shell">
      <section className="hero-grid">
        <div className="panel hero-panel">
          <p className="eyebrow">Vibraphone</p>
          <h1>A living painting built from what people feel in color.</h1>
          <p className="lede">
            Drag across the spectrum square, find the tone that matches the moment, and send it into the shared field.
          </p>

          <ColorSpectrum value={selection} onChange={setSelection} />

          <div className="selection-bar">
            <div className="selection-pill">
              <span className="selection-swatch" style={{ backgroundColor: selection.hexColor }} />
              <div>
                <strong>{selection.hexColor}</strong>
                <p>
                  x {selection.x.toFixed(2)} - y {selection.y.toFixed(2)}
                </p>
              </div>
            </div>

            <button className="share-button" onClick={handleShare} disabled={submitting}>
              {submitting ? "Sending..." : "Share my color"}
            </button>
          </div>

          <p className="status-line">{statusMessage}</p>
        </div>

        <aside className="panel sidebar-panel">
          <p className="eyebrow">Live pulse</p>
          <h2>Recent contributions</h2>
          <div className="recent-list">
            {recentSubmissions.length === 0 ? (
              <p className="muted">No contributions yet. The first color sets the mood.</p>
            ) : (
              recentSubmissions.map((submission) => (
                <div className="recent-item" key={`${submission.deviceId}-${submission.createdAt}`}>
                  <span
                    className="recent-swatch"
                    style={{ backgroundColor: submission.hexColor }}
                  />
                  <div>
                    <strong>{submission.hexColor}</strong>
                    <p>{new Date(submission.createdAt).toLocaleString()}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>
      </section>

      <RothkoCollage collage={collage} />
    </main>
  );
}
