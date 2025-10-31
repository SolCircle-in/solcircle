export const Logo = ({ className }: { className?: string }) => {
  // Note: place the provided image file at /public/solcircle.png
  return (
    <div className={`flex items-center ${className ?? ""}`}>
      <img
        src="/solcircle.png"
        alt="Solcirle logo"
        width={48}
        height={48}
        style={{ display: "inline-block", marginRight: 12 }}
      />
      <span style={{ fontWeight: 500, fontSize: 20 }} className="font-mono">Solcirle</span>
    </div>
  );
};
