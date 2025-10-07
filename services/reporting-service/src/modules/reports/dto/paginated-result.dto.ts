import { ApiProperty } from '@nestjs/swagger';

export class PaginationDto {
  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  total: number;

  @ApiProperty()
  pages: number;
}

export class PaginatedResult<T> {
  @ApiProperty({ isArray: true })
  data: T[];

  @ApiProperty({ type: PaginationDto })
  pagination: PaginationDto;
}
