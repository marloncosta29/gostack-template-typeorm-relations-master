import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,
    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,
    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customerExist = await this.customersRepository.findById(customer_id);
    if (!customerExist) {
      throw new AppError('Customer not found');
    }
    const productsExist = await this.productsRepository.findAllById(products);
    if (!productsExist.length) {
      throw new AppError('Not products found');
    }
    const existingProdIds = productsExist.map(p => p.id);

    const checkProducs = products.filter(p => !existingProdIds.includes(p.id));
    if (checkProducs.length) {
      throw new AppError('Could not find some products');
    }
    const findProductsWithNoQuantity = products.filter(
      prod =>
        productsExist.filter(p => p.id === prod.id)[0].quantity < prod.quantity,
    );

    if (findProductsWithNoQuantity.length) {
      throw new AppError('No quantity enought');
    }

    const serializedProducts = products.map(p => {
      return {
        product_id: p.id,
        quantity: p.quantity,
        price: productsExist.filter(prod => p.id === prod.id)[0].price,
      };
    });
    const order = await this.ordersRepository.create({
      customer: customerExist,
      products: serializedProducts,
    });
    const { order_products } = order;

    const orderedProductsQuantity = order_products.map(prod => ({
      id: prod.product_id,
      quantity:
        productsExist.filter(p => p.id === prod.product_id)[0].quantity -
        prod.quantity,
    }));

    await this.productsRepository.updateQuantity(orderedProductsQuantity);
    return order;
  }
}

export default CreateOrderService;
