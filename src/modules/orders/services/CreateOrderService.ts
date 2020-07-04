import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import OrdersProducts from '@modules/orders/infra/typeorm/entities/OrdersProducts';
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
    if (!products) {
      throw new AppError('No products added to order!', 400);
    }

    const customer = await this.customersRepository.findById(customer_id);

    if (!customer) {
      throw new AppError('Customer does not exists!');
    }

    const findProducts = await this.productsRepository.findAllById(products);

    if (findProducts.length !== products.length) {
      throw new AppError('One or more products does not exists!', 400);
    }

    const orderProducts = findProducts.map(findProduct => {
      const orderProduct = products.find(
        product => product.id === findProduct.id,
      );

      if (!orderProduct) {
        throw new AppError('Product does not exists!', 400);
      }

      if (orderProduct.quantity > findProduct.quantity) {
        throw new AppError(
          'You are requesting more quantity that we current have',
          400,
        );
      }

      return {
        id: findProduct.id,
        price: findProduct.price,
        newQuantity: findProduct.quantity - orderProduct.quantity,
        orderQuantity: orderProduct.quantity,
      };
    });

    const order = await this.ordersRepository.create({
      customer,
      products: orderProducts.map(product => {
        const orderProduct = new OrdersProducts();
        orderProduct.product_id = product.id;
        orderProduct.price = product.price;
        orderProduct.quantity = product.orderQuantity;

        return orderProduct;
      }),
    });

    await this.productsRepository.updateQuantity(
      orderProducts.map(product => {
        return {
          id: product.id,
          quantity: product.newQuantity,
        };
      }),
    );

    return order;
  }
}

export default CreateOrderService;
