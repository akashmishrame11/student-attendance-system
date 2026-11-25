export const DEFAULT_GRADING = [
  { grade: "O", min: 90, point: 10 },
  { grade: "A+", min: 80, point: 9 },
  { grade: "A", min: 70, point: 8 },
  { grade: "B+", min: 60, point: 7 },
  { grade: "B", min: 50, point: 6 },
  { grade: "C", min: 40, point: 5 },
  { grade: "F", min: 0, point: 0 },
];

export function calcGrade(percentage, scale = DEFAULT_GRADING) {
  const sorted = [...(scale?.length ? scale : DEFAULT_GRADING)].sort((a, b) => b.min - a.min);
  return (sorted.find((g) => percentage >= g.min) || sorted[sorted.length - 1]).grade;
}
