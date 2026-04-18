export default function Home() {
  return (
    <main
      style={{
        fontFamily: "system-ui, sans-serif",
        padding: "2rem",
        maxWidth: "40rem",
      }}
    >
      <h1 style={{ fontSize: "1.25rem", fontWeight: 600 }}>
        YouTube DJ Prep — API
      </h1>
      <p style={{ marginTop: "0.75rem", color: "#444" }}>
        App Router API server. Try{" "}
        <a href="/api/health">GET /api/health</a> for a JSON health check.
      </p>
    </main>
  );
}
