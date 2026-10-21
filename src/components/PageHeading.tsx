interface PageHeadingProps {
  eyebrow: string;
  title: string;
  description: string;
}

/** Compact heading shared by every page that is not the catalogue. */
export function PageHeading({ eyebrow, title, description }: PageHeadingProps) {
  return (
    <div className="page-heading">
      <div className="eyebrow">
        <span className="eyebrow-dot" />
        {eyebrow}
      </div>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  );
}
