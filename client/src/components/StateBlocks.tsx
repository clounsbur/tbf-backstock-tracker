export function LoadingBlock() {
  return <div className="state-block">Loading live warehouse data...</div>;
}

export function ErrorBlock({ message }: { message: string }) {
  return <div className="state-block error">{message}</div>;
}

export function EmptyBlock({ message }: { message: string }) {
  return <div className="state-block">{message}</div>;
}
