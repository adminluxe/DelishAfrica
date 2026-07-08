import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { DaAuthSession, daMe } from "../utils/daAuthBridge";

function daSessionPillLabel(session: DaAuthSession | null, role?: string): string {
if (!session) return role ? String(role).toUpperCase() : "SESSION";

const data = session as unknown as Record<string, unknown>;
const nestedUser = data.user && typeof data.user === "object"
? (data.user as Record<string, unknown>)
: null;

const name =
typeof data.name === "string" ? data.name :
nestedUser && typeof nestedUser.name === "string" ? nestedUser.name :
typeof data.email === "string" ? data.email :
nestedUser && typeof nestedUser.email === "string" ? nestedUser.email :
"";

const sessionRole =
typeof data.role === "string" ? data.role :
role ? String(role) :
"client";

return name ? `${sessionRole.toUpperCase()} · ${name}` : sessionRole.toUpperCase();
}


type Props = {
  role: "client" | "merchant" | "courier" | "ops";
};

export default function DaSessionPill({ role }: Props) {
  const [session, setSession] = useState<DaAuthSession | null>(null);

  useEffect(() => {
    let alive = true;

    daMe()
      .then((next) => {
        if (alive) setSession(next);
      })
      .catch(() => {
        if (alive) {
          setSession({
            ok: false,
            authenticated: false,
            required: false,
            reason: "session_not_loaded",
          });
        }
      });

    return () => {
      alive = false;
    };
  }, []);

  const active = Boolean(session?.authenticated);
  const label = daSessionPillLabel(session, role);

  return (
    <View style={[styles.pill, active ? styles.active : styles.ready]}>
      <Text style={[styles.text, active ? styles.activeText : styles.readyText]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginBottom: 12,
    borderWidth: 1,
  },
  active: {
    backgroundColor: "rgba(22, 163, 74, 0.14)",
    borderColor: "rgba(22, 163, 74, 0.44)",
  },
  ready: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderColor: "rgba(255, 255, 255, 0.16)",
  },
  text: {
    fontSize: 12,
    fontWeight: "800",
  },
  activeText: {
    color: "#15803D",
  },
  readyText: {
    color: "#6B7280",
  },
});
