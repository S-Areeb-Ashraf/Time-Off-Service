import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { RequestService } from './request.service';
import { CreateRequestDto } from './dto/create-request.dto';

@Controller('time-off/request')
export class RequestController {
  constructor(private readonly requestService: RequestService) {}

  /**
   * POST /time-off/request
   * Submit a new time-off request.
   */
  @Post()
  async createRequest(@Body() dto: CreateRequestDto) {
    return this.requestService.createRequest(dto);
  }

  /**
   * GET /time-off/request
   * List all requests, optionally filtered by employeeId.
   */
  @Get()
  async listRequests(@Query('employeeId') employeeId?: string) {
    return this.requestService.listRequests(employeeId);
  }

  /**
   * GET /time-off/request/:id
   * Get a request by ID.
   */
  @Get(':id')
  async getRequest(@Param('id', ParseIntPipe) id: number) {
    return this.requestService.getRequest(id);
  }

  /**
   * PATCH /time-off/request/:id/cancel
   * Cancel a PENDING request.
   */
  @Patch(':id/cancel')
  async cancelRequest(@Param('id', ParseIntPipe) id: number) {
    return this.requestService.cancelRequest(id);
  }
}
