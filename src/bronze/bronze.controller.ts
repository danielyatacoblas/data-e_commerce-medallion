import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { BronzeService } from './bronze.service';
import { CreateEventDto } from './dto/create-event.dto';

@Controller('v1')
export class BronzeController {
  constructor(private readonly bronzeService: BronzeService) {}

  @Post('events')
  @HttpCode(201)
  async receiveEvent(@Body() createEventDto: CreateEventDto) {
    return this.bronzeService.ingest(createEventDto);
  }
}
