import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsString,
  ValidateNested,
} from 'class-validator';
import { SaleEvent, ProductInfo } from '../../common/interfaces/event.interface';

export class ProductDto implements ProductInfo {
  @IsString()
  @IsNotEmpty()
  id!: string;

  @IsString()
  @IsNotEmpty()
  category!: string;

  @IsNumber()
  price!: number;
}

export class CreateEventDto implements SaleEvent {
  @IsString()
  @IsNotEmpty()
  transaction_id!: string;

  @IsString()
  @IsNotEmpty()
  customer_id!: string;

  @IsString()
  @IsNotEmpty()
  timestamp!: string;

  @IsObject()
  @ValidateNested()
  @Type(() => ProductDto)
  product!: ProductDto;

  @IsNumber()
  quantity!: number;
}
