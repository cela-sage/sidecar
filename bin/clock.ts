export const clock = (at: string): string => {
  const when = new Date(at);
  const time = when.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return when.toDateString() === new Date().toDateString()
    ? time
    : `${when.toLocaleDateString([], { day: "numeric", month: "short" })} ${time}`;
};
