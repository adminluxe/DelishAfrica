import React from "react";
import { View } from "react-native";
import { Screen, DAHeader, StatCard, StatusPill, DAButton, SkeletonLine, DAInlineNotice, DAListItem, DAFadeIn } from "../ui/da";

const APP = "merchant" as const;

export default function TontonSignature(){
  return (
    <Screen app={APP} scroll pad="lg">
      <DAHeader app={APP} title="Signature Tonton" subtitle="Luxe + tech futuriste, sans friction." />
      <DAFadeIn>
        <View style={{ gap: 14 }}>
          <StatCard
            app={APP}
            title="Gains (semaine)"
            value="82 500 XAF"
            hint="Objectif: 120 000 - tu es sur la bonne trajectoire."
            rightPill={<StatusPill app={APP} status="ONLINE" label="Disponible" />}
          />

          <StatCard
            app={APP}
            title="Missions"
            value="3 en cours"
            hint="Priorite: 1 mission urgente a 12 min."
            rightPill={<StatusPill app={APP} status="MISSION" label="En mission" />}
          />

          <DAListItem
            app={APP}
            title="Mission #DA-1024"
            subtitle="Distance 3.2 km - Prime incluse"
            right={<StatusPill app={APP} status="WARN" label="Urgent" />}
          />

          <DAInlineNotice
            app={APP}
            kind="info"
            title="Micro-interactions"
            body="Press sur les CTA, transitions douces, feedback elegant."
          />

          <View style={{ gap: 10 }}>
            <DAButton app={APP} label="Accepter la mission" variant="primary" />
            <DAButton app={APP} label="Refuser (raison)" variant="secondary" />
            <DAButton app={APP} label="Uploader un document" variant="ghost" />
            <DAButton app={APP} label="Support" variant="danger" />
          </View>

          <View style={{ gap: 10, marginTop: 6 }}>
            <SkeletonLine app={APP} h={14} />
            <SkeletonLine app={APP} h={14} w="75%" />
            <SkeletonLine app={APP} h={14} w="55%" />
          </View>
        </View>
      </DAFadeIn>
    </Screen>
  );
}
