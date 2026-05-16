/** 返回设备本地时间的 ISO 字符串，固定附加 +08:00 后缀。格式：2026-05-16T14:30:00+08:00 */
export function nowCST(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}+08:00`
  );
}
