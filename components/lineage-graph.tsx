// Граф происхождения данных (data lineage): источник → коннектор → каталог →
// значение → паспорта решений, где это число используется. Чистый SVG без библиотек.

export interface LineageNode {
  id: string;
  title: string;
  subtitle?: string;
  kind: "source" | "connector" | "catalog" | "value" | "decision";
}

const KIND_STYLE: Record<LineageNode["kind"], { fill: string; stroke: string; text: string }> = {
  source: { fill: "#12305B", stroke: "#12305B", text: "#FFFFFF" },
  connector: { fill: "#EAF1F9", stroke: "#2E6DB4", text: "#12305B" },
  catalog: { fill: "#2E6DB4", stroke: "#2E6DB4", text: "#FFFFFF" },
  value: { fill: "#FFFFFF", stroke: "#2E6DB4", text: "#12305B" },
  decision: { fill: "#FFFFFF", stroke: "#CBD5E1", text: "#334155" },
};

const COL_W = 190;
const BOX_W = 168;
const BOX_H = 52;
const ROW_H = 66;

export function LineageGraph({ columns }: { columns: LineageNode[][] }) {
  const rows = Math.max(1, ...columns.map((c) => c.length));
  const width = columns.length * COL_W;
  const height = rows * ROW_H + 16;

  const boxY = (colLen: number, i: number): number => {
    const total = colLen * ROW_H;
    const offset = (height - total) / 2;
    return offset + i * ROW_H;
  };

  return (
    <div className="overflow-x-auto">
      <svg width={width} height={height} role="img" aria-label="Граф происхождения данных">
        {/* связи между соседними колонками */}
        {columns.slice(0, -1).map((col, ci) => {
          const next = columns[ci + 1] ?? [];
          return col.flatMap((node, i) =>
            next.map((_, j) => {
              const x1 = ci * COL_W + BOX_W;
              const y1 = boxY(col.length, i) + BOX_H / 2;
              const x2 = (ci + 1) * COL_W;
              const y2 = boxY(next.length, j) + BOX_H / 2;
              const mx = (x1 + x2) / 2;
              return (
                <path
                  key={`${node.id}-${ci}-${j}`}
                  d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
                  fill="none"
                  stroke="#CBD5E1"
                  strokeWidth={1}
                />
              );
            })
          );
        })}

        {columns.map((col, ci) =>
          col.map((node, i) => {
            const style = KIND_STYLE[node.kind];
            const x = ci * COL_W;
            const y = boxY(col.length, i);
            return (
              <g key={node.id}>
                <rect
                  x={x}
                  y={y}
                  width={BOX_W}
                  height={BOX_H}
                  rx={3}
                  fill={style.fill}
                  stroke={style.stroke}
                  strokeWidth={1}
                />
                <text x={x + 10} y={y + 21} fontSize={11} fontWeight={600} fill={style.text}>
                  {node.title.length > 24 ? `${node.title.slice(0, 23)}…` : node.title}
                </text>
                {node.subtitle && (
                  <text x={x + 10} y={y + 37} fontSize={10} fill={style.text} opacity={0.8}>
                    {node.subtitle.length > 27 ? `${node.subtitle.slice(0, 26)}…` : node.subtitle}
                  </text>
                )}
              </g>
            );
          })
        )}
      </svg>
    </div>
  );
}
