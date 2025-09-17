import { WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody, ConnectedSocket } from "@nestjs/websockets";
import { Server, Socket } from "socket.io";

@WebSocketGateway({ namespace: "/dispatch", cors: { origin: "*" } })
export class DispatchGateway {
  @WebSocketServer() server: Server;

  @SubscribeMessage("join")
  handleJoin(@MessageBody() data: { orderId: string }, @ConnectedSocket() client: Socket) {
    if (data?.orderId) client.join(data.orderId);
  }

  @SubscribeMessage("courierLocation")
  courierLocation(@MessageBody() data: { orderId: string; lat: number; lng: number }) {
    if (data?.orderId) this.server.to(data.orderId).emit("courierLocationUpdate", data);
  }

  @SubscribeMessage("chat")
  chat(@MessageBody() m: { orderId: string; sender: "customer"|"merchant"|"courier"; text: string }) {
    if (m?.orderId) this.server.to(m.orderId).emit("chatMessage", m);
  }
}
