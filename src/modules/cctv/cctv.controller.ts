import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { CctvService } from './cctv.service';
import { CreateCctvDto } from './create-cctv.dto';
import { UpdateCctvDto } from './update-cctv.dto';
import { QueryCctvDto } from './query-cctv.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';


@Controller('cctv')
@UseGuards(JwtAuthGuard)
export class CctvController {
  constructor(private readonly cctvService: CctvService) {}

  @Post()
  create(@Body() createDto: CreateCctvDto) {
    return this.cctvService.create(createDto);
  }

  @Get()
  findAll(@Query() queryDto: QueryCctvDto) {
    return this.cctvService.findAll(queryDto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.cctvService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDto: UpdateCctvDto) {
    return this.cctvService.update(id, updateDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.cctvService.remove(id);
  }
}