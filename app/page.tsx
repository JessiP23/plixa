import Link from "next/link";

export default function Home() {
  return (
    <main>
      <nav className="landing-nav">
        <Link href="/" className="wordmark">Plixa</Link>
        <div className="nav-links">
          <a href="#review">How a review runs</a>
          <Link href="/studio">Studio</Link>
        </div>
      </nav>
      <section className="hero">
        <p className="eyebrow">For architecture and design-build studios</p>
        <h1>Floor-plan review that cites the code.</h1>
        <p className="lede">
          Upload a plan, or start from geometry the perception pipeline already extracted.
          Plixa writes a structured plan, then a deterministic rule kernel checks it against
          the jurisdiction pack. A miss is a miss. Missing data stays inconclusive.
        </p>
        <div className="hero-actions row">
          <Link className="button" href="/studio">Open the studio</Link>
          <a className="button-secondary" href="#review">See the three stages</a>
        </div>
      </section>
      <section className="band grid-3" id="review">
        <article className="card">
          <span>01 Perceive</span>
          <h2>Read the sheet</h2>
          <p>Walls, rooms, doors, and printed dimensions become a structured intermediate representation. The vision model stays a separate worker. This app reviews the IR it produces.</p>
        </article>
        <article className="card">
          <span>02 Structure</span>
          <h2>One contract</h2>
          <p>Rooms, openings, stairs, and adjacencies land in one JSON document. Every rule reads that document. Adding a rule does not rewrite the ones already certified.</p>
        </article>
        <article className="card">
          <span>03 Verify</span>
          <h2>Cite the section</h2>
          <p>The kernel evaluates the IRC 2021 pack. Each verdict carries the measured value, the required value, and the code section. It does not guess a pass.</p>
        </article>
      </section>
    </main>
  );
}
