import { Body, Controller, Get, Post } from '@nestjs/common';
import { RoutesPreviewService } from './routes-preview.service';
import { RoutePreviewInput } from './routes-preview.types';

@Controller('routes')
export class RoutesPreviewController {
constructor(private readonly routesPreview: RoutesPreviewService) {}

@Get('health')
health() {
return {
ok: true,
service: 'routes-preview',
mode: 'google_routes_proxy_with_fallback',
providerReady: this.routesPreview.providerReady(),
keyExposedToClient: false,
};
}

@Post('preview')
preview(@Body() body: RoutePreviewInput = {}) {
return this.routesPreview.preview(body || {});
}
}
