type StructuredDataProps = {
  blocks: string[];
};

export function StructuredData({ blocks }: StructuredDataProps) {
  return (
    <>
      {blocks.map((block, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: block }}
        />
      ))}
    </>
  );
}
