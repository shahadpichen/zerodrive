export function StatusNotice({
  title,
  children,
  tone = "neutral",
}: {
  title: string;
  children: React.ReactNode;
  tone?: "neutral" | "danger" | "warning";
}) {
  return (
    <div
      className={`notice notice--${tone}`}
      role={tone === "danger" ? "alert" : "status"}
    >
      <strong>{title}</strong>
      <div>{children}</div>
    </div>
  );
}
