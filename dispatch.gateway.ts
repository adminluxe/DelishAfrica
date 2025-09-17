import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

/**
 * WebSocket gateway responsible for dispatch‑related real‑time communications.
 *
 * Clients join rooms identified by the order ID. Location updates from
 * couriers are broadcast to the room so that customers and merchants can
 * track progress. Chat messages between customer, courier and merchant are
 * also relayed via the same order room.
 */
@WebSocketGateway({ namespace: '/dispatch', cors: { origin: '*' } })
export class DispatchGateway {
  @WebSocketServer()
  server: Server;

  /**
   * Handle a client joining a specific order room. A client must provide
   * `{ orderId: string }` in the message body. Once joined, the client will
   * receive updates broadcast to this room.
   */
  @SubscribeMessage('join')
  handleJoin(
    @MessageBody() data: { orderId: string },
    @ConnectedSocket() client: Socket,
  ) {
    if (data?.orderId) {
      client.join(data.orderId);
    }
  }

  /**
   * Receive a location update from a courier and broadcast it to the relevant
   * order room. The payload must contain the orderId and coordinates.
   */
  @SubscribeMessage('courierLocation')
  handleCourierLocationUpdate(
    @MessageBody() data: { orderId: string; lat: number; lng: number },
  ) {
    if (data?.orderId) {
      this.server.to(data.orderId).emit('courierLocationUpdate', data);
    }
  }

  /**
   * Relay a chat message between participants in an order. The payload
   * must include orderId, sender type and message text.
   */
  @SubscribeMessage('chat')
  handleChatMessage(
    @MessageBody() message: {
      orderId: string;
      sender: 'customer' | 'merchant' | 'courier';
      text: string;
    },
  ) {
    if (message?.orderId) {
      this.server.to(message.orderId).emit('chatMessage', message);
    }
  }
}