import type { User } from "@shoplist/api-client";

import { initials, personColor } from "../lib/people";

export interface MembersProps {
  members: User[];
  currentUserId: string;
  max?: number;
}

export function Members({ members, currentUserId, max = 5 }: MembersProps) {
  const shown = members.slice(0, max);
  const hidden = members.length - shown.length;
  const names = members.map((m) => (m.id === currentUserId ? `${m.display_name} (ty)` : m.display_name));
  return (
    <div className="members" aria-label={`Na liście: ${names.join(", ")}`} role="img">
      {shown.map((m) => (
        <span
          key={m.id}
          className="members__avatar"
          style={{ backgroundColor: personColor(m.id) }}
          title={m.id === currentUserId ? `${m.display_name} (ty)` : m.display_name}
        >
          {initials(m.display_name)}
        </span>
      ))}
      {hidden > 0 && <span className="members__avatar members__avatar--more">+{hidden}</span>}
    </div>
  );
}
