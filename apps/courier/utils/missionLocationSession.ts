import type { JourneyMode, JourneyPoint } from "../../../packages/contracts/src/missionJourney";

export type MissionFix = JourneyPoint & { accuracyMeters: number | null; headingDegrees: number | null; speedMetersPerSecond: number | null; capturedAt: number };
export type MissionLocationState = {
  orderId: string | null; mode: JourneyMode | null; fix: MissionFix | null;
  sharing: boolean; locating: boolean; paused: boolean; message: string;
  sharingRequested: boolean; tracking: boolean;
  lastPublishedAt: number | null;
};
type Subscription = { remove(): void };
export type MissionLocationAdapter = {
  permission(): Promise<boolean>;
  current(): Promise<MissionFix>;
  watch(onFix: (fix: MissionFix) => void, onError: () => void): Promise<Subscription>;
  validate(orderId: string): Promise<boolean>;
  publish(orderId: string, fix: MissionFix, mode: JourneyMode | null, sessionId: string): Promise<void>;
  stop(orderId: string, sessionId: string): Promise<void>;
  id(): string;
};

const initial = (): MissionLocationState => ({ orderId: null, mode: null, fix: null, sharing: false, sharingRequested: false, tracking: false, locating: false, paused: false, message: "Votre position reste privée tant que le partage n’est pas activé.", lastPublishedAt: null });

/** The session belongs to the app, not to a particular map screen. */
export class MissionLocationSession {
  private state = initial();
  private listeners = new Set<() => void>();
  private generation = 0;
  private watcher: Subscription | null = null;
  private sessionId: string | null = null;
  private publishing = new Set<number>();
  private pendingStops = new Map<string, { orderId: string; sessionId: string }>();
  private flushingStops = false;
  private consent = false;
  private active = true;
  private disposed = false;
  constructor(private adapter: MissionLocationAdapter) {}

  snapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private update(value: Partial<MissionLocationState>) {
    if (this.disposed) return;
    this.state = { ...this.state, ...value };
    this.listeners.forEach((listener) => listener());
  }

  setMode(mode: JourneyMode | null) { this.update({ mode }); }

  private detach() {
    this.generation += 1;
    this.watcher?.remove(); this.watcher = null;
    const id = this.state.orderId; const session = this.sessionId;
    this.sessionId = null;
    if (id && session) {
      this.pendingStops.set(session, { orderId: id, sessionId: session });
      void this.flushStops();
    }
  }

  private async flushStops() {
    if (this.flushingStops) return;
    this.flushingStops = true;
    try {
      for (const [key, value] of this.pendingStops) {
        try { await this.adapter.stop(value.orderId, value.sessionId); this.pendingStops.delete(key); }
        catch { /* Retry on the next foreground validation without restarting GPS. */ }
      }
    } finally { this.flushingStops = false; }
  }

  async locate() { return this.begin(null, false); }
  async share(orderId: string, mode: JourneyMode | null) {
    this.update({ mode });
    return this.begin(orderId, true);
  }

  private async begin(orderId: string | null, share: boolean) {
    this.detach();
    this.consent = share;
    const generation = this.generation;
    this.update({ orderId, sharingRequested: share, tracking: false, sharing: false, locating: true, paused: false, fix: null, lastPublishedAt: null, message: "Localisation en cours…" });
    try {
      if (!this.active || !(await this.adapter.permission())) throw new Error("permission_denied");
      if (generation !== this.generation || this.disposed || !this.active) return;
      if (share && (!orderId || !(await this.adapter.validate(orderId)))) throw new Error("mission_unavailable");
      if (generation !== this.generation || this.disposed || !this.active) return;
      this.sessionId = share ? this.adapter.id() : null;
      const fix = await this.adapter.current();
      if (generation !== this.generation || this.disposed || !this.active) return;
      this.update({ fix, locating: false });
      if (share) {
        await this.send(fix, generation);
        if (generation !== this.generation || !this.consent) return;
      }
      const watcher = await this.adapter.watch((next) => {
        if (generation !== this.generation || this.disposed || !this.active) return;
        this.update({ fix: next });
        if (this.consent) void this.send(next, generation);
      }, () => {
        if (generation === this.generation) this.update({ message: "Position momentanément indisponible. Le dernier point reste daté." });
      });
      if (generation !== this.generation || this.disposed || !this.active) { watcher.remove(); return; }
      this.watcher = watcher;
      this.update({ locating: false, tracking: true, ...(!share ? { message: "Votre position est affichée uniquement sur votre appareil." } : {}) });
    } catch (error) {
      if (generation !== this.generation) return;
      this.consent = false;
      this.detach();
      const reason = error instanceof Error ? error.message : "";
      this.update({ locating: false, sharing: false, sharingRequested: false, tracking: false, orderId: null, message: reason === "permission_denied"
        ? "La localisation n’est pas autorisée. Les adresses de mission restent disponibles."
        : reason === "mission_unavailable" ? "Le partage nécessite une mission acceptée et prête au retrait."
        : "Le suivi ne peut pas démarrer pour le moment. Réessayez lorsque la connexion revient." });
    }
  }

  private async send(fix: MissionFix, generation: number) {
    const orderId = this.state.orderId; const session = this.sessionId;
    if (!orderId || !session || !this.consent || !this.active || this.publishing.has(generation)) return;
    this.publishing.add(generation);
    try {
      await this.adapter.publish(orderId, fix, this.state.mode, session);
      if (generation === this.generation) this.update({ sharing: true, lastPublishedAt: Date.now(), message: "Position partagée avec le client et le restaurant." });
    } catch (error) {
      if (generation !== this.generation) return;
      const status = (error as any)?.status;
      if ([401, 403, 404, 409].includes(status)) {
        this.stop("Le partage s’est arrêté. Vérifiez votre mission et votre connexion au compte.");
      } else {
        this.update({ sharing: false, message: "Partage non confirmé. Le client voit l’heure de la dernière position reçue." });
      }
    } finally { this.publishing.delete(generation); }
  }

  stop(message = "Partage arrêté. Votre position n’est plus transmise.") {
    this.consent = false;
    this.detach();
    this.update({ sharing: false, sharingRequested: false, tracking: false, locating: false, paused: false, orderId: null, message });
  }

  /** Foreground-only is an explicit limit, not a promise of locked-screen tracking. */
  setActive(active: boolean) {
    if (this.active === active || this.disposed) return;
    this.active = active;
    if (!active) {
      this.detach();
      this.update({ sharing: false, tracking: false, locating: false, paused: this.consent, message: this.consent ? "Partage en pause pendant que l’application est en arrière-plan." : "Localisation en pause pendant que l’application est en arrière-plan." });
    } else if (this.consent && this.state.orderId) {
      void this.begin(this.state.orderId, true);
    }
  }

  async revalidate() {
    if (this.active) void this.flushStops();
    if (!this.consent || !this.state.orderId || !this.active) return;
    const generation = this.generation; const order = this.state.orderId;
    try {
      const valid = await this.adapter.validate(order);
      if (!valid && generation === this.generation) this.stop("La mission est terminée ou n’est plus disponible. Le partage est arrêté.");
    } catch { /* A network gap ages the last signal; it never invents a new point. */ }
  }

  dispose() {
    this.stop();
    this.disposed = true;
    this.listeners.clear();
  }
}
