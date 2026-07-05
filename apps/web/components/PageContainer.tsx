/**
 * PageContainer — wraps content on standard-mode pages.
 *
 * Rules:
 * - Full available width up to a sensible max (1400px)
 * - Centered horizontally in the content area
 * - Consistent horizontal padding that scales with viewport
 * - No max-width on wide layouts like dashboards/grids (they use `wide` prop)
 */

interface PageContainerProps {
  children: React.ReactNode;
  /** "normal" = max-w-3xl (forms, settings, single-column lists)
   *  "wide"   = max-w-6xl (grids, dashboards, tables)
   *  "full"   = no max-width (graph, editor — handle internally) */
  width?: "normal" | "wide" | "full";
  className?: string;
}

export default function PageContainer({
  children,
  width = "wide",
  className = "",
}: PageContainerProps) {
  const maxW =
    width === "normal" ? "max-w-3xl" :
    width === "wide"   ? "max-w-6xl" :
    "";

  return (
    <div className={`w-full mx-auto px-6 md:px-8 lg:px-10 py-8 ${maxW} ${className}`}>
      {children}
    </div>
  );
}
