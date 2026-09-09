import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { InstitutesService } from './institutes.service';
import { CreateInstituteDto } from './dto/create-institute.dto';
import { UpdateInstituteDto } from './dto/update-institute.dto';
import { QueryInstituteDto } from './dto/query-institute.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('institutes')
@UseGuards(JwtAuthGuard)
export class InstitutesController {
  constructor(private readonly institutesService: InstitutesService) {}

  @Post()
  create(@Body() createDto: CreateInstituteDto) {
    return this.institutesService.create(createDto);
  }

  @Get()
  findAll(@Query() queryDto: QueryInstituteDto) {
    return this.institutesService.findAll(queryDto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.institutesService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDto: UpdateInstituteDto) {
    return this.institutesService.update(id, updateDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.institutesService.remove(id);
  }
}