import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { Injectable, Logger } from '@nestjs/common';

interface GatewayUser {
  sub: string;
  email?: string;
  role?: string;
}

type AuthenticatedSocket = Socket & {
  data: Socket['data'] & { user?: GatewayUser };
};

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  path: '/ws',
})
@Injectable()
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(EventsGateway.name);

  constructor(private readonly jwtService: JwtService) {}

  private extractToken(client: Socket): string | undefined {
    const fromQuery = client.handshake.query?.token;
    if (typeof fromQuery === 'string' && fromQuery) {
      return fromQuery;
    }
    const fromAuth = (client.handshake.auth as Record<string, unknown> | undefined)?.token;
    if (typeof fromAuth === 'string' && fromAuth) {
      return fromAuth;
    }
    const header = client.handshake.headers?.authorization;
    if (typeof header === 'string' && header.startsWith('Bearer ')) {
      return header.slice('Bearer '.length);
    }
    return undefined;
  }

  handleConnection(client: AuthenticatedSocket) {
    const token = this.extractToken(client);
    if (!token) {
      this.logger.warn(`Rejected WS connection ${client.id}: missing token`);
      client.disconnect();
      return;
    }
    try {
      const payload = this.jwtService.verify(token, { algorithms: ['RS256'] });
      client.data.user = { sub: payload.sub, email: payload.email, role: payload.role };
      this.logger.log(`Client connected: ${client.id} (user=${payload.sub})`);
    } catch (err) {
      this.logger.warn(`Rejected WS connection ${client.id}: ${(err as Error).message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('subscribe:inspections')
  handleSubscribeInspections(@ConnectedSocket() client: AuthenticatedSocket) {
    client.join('inspections');
    return { event: 'subscribed', data: { channel: 'inspections' } };
  }

  @SubscribeMessage('subscribe:anomalies')
  handleSubscribeAnomalies(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: any,
  ) {
    client.join('anomalies');
    return { event: 'subscribed', data: { channel: 'anomalies', scope: data?.scope ?? null } };
  }

  @SubscribeMessage('location:ping')
  handleLocationPing(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: any,
  ) {
    this.broadcastCctvStatusChanged({
      officerId: client.data.user?.sub,
      ...data,
      at: new Date().toISOString(),
    });
    return { event: 'ack', data: 'location received' };
  }

  emitToAdmins(event: string, data: any) {
    this.server.to('anomalies').emit(event, data);
  }

  broadcastAnomalyDetected(data: { anomalyId: string; type: string; severity: string }) {
    this.server.to('anomalies').emit('anomaly:detected', data);
  }

  broadcastInspectionAssigned(data: any) {
    this.server.to('inspections').emit('inspection:assigned', data);
  }

  broadcastCctvStatusChanged(data: any) {
    this.server.emit('cctv:status_changed', data);
  }
}
