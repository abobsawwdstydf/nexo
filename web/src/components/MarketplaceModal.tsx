import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Star, Shield, TrendingUp, Filter, DollarSign, Clock, CheckCircle } from 'lucide-react';
import { ClearInput } from './ClearInput';
import api from '../lib/api';
import { useAuthStore } from '../stores/authStore';

interface MarketplaceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Service {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  seller: {
    id: string;
    username: string;
    displayName: string;
    avatar?: string;
    rating: number;
    completedOrders: number;
  };
  rating: number;
  reviewsCount: number;
  deliveryTime: string;
  images: string[];
  createdAt: string;
}

export default function MarketplaceModal({ isOpen, onClose }: MarketplaceModalProps) {
  const { user } = useAuthStore();
  const [tab, setTab] = useState<'browse' | 'my-services' | 'orders'>('browse');
  const [services, setServices] = useState<Service[]>([]);
  const [myServices, setMyServices] = useState<Service[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'popular' | 'price-low' | 'price-high' | 'rating'>('popular');
  const [showCreateService, setShowCreateService] = useState(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);

  const categories = [
    { id: 'all', label: 'Все', icon: '🌐' },
    { id: 'design', label: 'Дизайн', icon: '🎨' },
    { id: 'development', label: 'Разработка', icon: '💻' },
    { id: 'marketing', label: 'Маркетинг', icon: '📈' },
    { id: 'writing', label: 'Копирайтинг', icon: '✍️' },
    { id: 'video', label: 'Видео', icon: '🎬' },
    { id: 'music', label: 'Музыка', icon: '🎵' },
    { id: 'consulting', label: 'Консультации', icon: '💼' },
    { id: 'other', label: 'Другое', icon: '📦' },
  ];

  useEffect(() => {
    if (isOpen) {
      if (tab === 'browse') loadServices();
      if (tab === 'my-services') loadMyServices();
      if (tab === 'orders') loadOrders();
    }
  }, [isOpen, tab, selectedCategory, sortBy]);

  const loadServices = async () => {
    setLoading(true);
    try {
      const qp = new URLSearchParams();
      if (selectedCategory !== 'all') qp.set('category', selectedCategory);
      qp.set('sortBy', sortBy);
      if (searchQuery) qp.set('search', searchQuery);
      const response = await api.get('/marketplace/services?' + qp.toString());
      setServices(response.data);
    } catch (error) {
      console.error('Error loading services:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMyServices = async () => {
    setLoading(true);
    try {
      const response = await api.get('/marketplace/my-services');
      setMyServices(response.data);
    } catch (error) {
      console.error('Error loading my services:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadOrders = async () => {
    setLoading(true);
    try {
      const response = await api.get('/marketplace/orders');
      setOrders(response.data);
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (serviceId: string) => {
    try {
      await api.post(`/marketplace/services/${serviceId}/purchase`, {});
      alert('Заказ создан! Средства заморожены в эскроу до завершения работы.');
      setTab('orders');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Ошибка покупки');
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-6xl h-[85vh] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-surface-secondary">
            <div className="flex items-center gap-3">
              <Shield className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Маркетплейс услуг
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/50 dark:hover:bg-gray-700/50 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200 dark:border-gray-700">
            {[
              { id: 'browse', label: 'Обзор', icon: Search },
              { id: 'my-services', label: 'Мои услуги', icon: Star },
              { id: 'orders', label: 'Заказы', icon: Clock },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id as any)}
                className={`flex-1 px-4 py-3 flex items-center justify-center gap-2 transition-colors ${
                  tab === id
                    ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 border-b-2 border-purple-600'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-sm font-medium">{label}</span>
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {tab === 'browse' && (
              <div className="p-6">
                {/* Search and Filters */}
                <div className="mb-6 space-y-4">
                  <ClearInput
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Поиск услуг..."
                    className="w-full bg-gray-100 dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 py-3"
                    leftIcon={<Search className="w-5 h-5 text-gray-400" />}
                  />

                  {/* Categories */}
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {categories.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => setSelectedCategory(cat.id)}
                        className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
                          selectedCategory === cat.id
                            ? 'bg-purple-600 text-white'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                      >
                        <span className="mr-2">{cat.icon}</span>
                        {cat.label}
                      </button>
                    ))}
                  </div>

                  {/* Sort */}
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-gray-500" />
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                      className="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="popular">Популярные</option>
                      <option value="price-low">Цена: низкая → высокая</option>
                      <option value="price-high">Цена: высокая → низкая</option>
                      <option value="rating">Рейтинг</option>
                    </select>
                  </div>
                </div>

                {/* Services Grid */}
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600" />
                  </div>
                ) : services.length === 0 ? (
                  <div className="text-center py-12">
                    <Shield className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-500 dark:text-gray-400">Услуги не найдены</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {services.map((service) => (
                      <div
                        key={service.id}
                        className="bg-gray-50 dark:bg-gray-700/50 rounded-xl overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                        onClick={() => setSelectedService(service)}
                      >
                        {service.images[0] && (
                          <img
                            src={service.images[0]}
                            alt={service.title}
                            className="w-full h-48 object-cover"
                          />
                        )}
                        <div className="p-4">
                          <h3 className="font-semibold text-gray-900 dark:text-white mb-2 line-clamp-2">
                            {service.title}
                          </h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
                            {service.description}
                          </p>
                          <div className="flex items-center gap-2 mb-3">
                            <img
                              src={service.seller.avatar || '/default-avatar.png'}
                              alt={service.seller.displayName}
                              className="w-6 h-6 rounded-full"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300">
                              {service.seller.displayName}
                            </span>
                            <div className="flex items-center gap-1 ml-auto">
                              <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                              <span className="text-sm font-medium">{service.rating.toFixed(1)}</span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                             
                              <span className="text-lg font-bold text-gray-900 dark:text-white">
                                {service.price}
                              </span>
                            </div>
                            <span className="text-xs text-gray-500">
                              <Clock className="w-3 h-3 inline mr-1" />
                              {service.deliveryTime}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === 'my-services' && (
              <div className="p-6">
                <button
                  onClick={() => setShowCreateService(true)}
                  className="w-full mb-6 px-4 py-3 bg-nexo-500 text-white rounded-lg hover:bg-nexo-600 transition-all font-medium"
                >
                  + Создать услугу
                </button>

                {myServices.length === 0 ? (
                  <div className="text-center py-12">
                    <Star className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-500 dark:text-gray-400">У вас пока нет услуг</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {myServices.map((service) => (
                      <div
                        key={service.id}
                        className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl"
                      >
                        <div className="flex items-start gap-4">
                          {service.images[0] && (
                            <img
                              src={service.images[0]}
                              alt={service.title}
                              className="w-24 h-24 rounded-lg object-cover"
                            />
                          )}
                          <div className="flex-1">
                            <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                              {service.title}
                            </h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                              {service.description}
                            </p>
                            <div className="flex items-center gap-4 text-sm">
                              <div className="flex items-center gap-1">
                               
                                <span className="font-medium">{service.price}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Star className="w-4 h-4 text-yellow-500" />
                                <span>{service.rating.toFixed(1)}</span>
                              </div>
                              <span className="text-gray-500">
                                {service.reviewsCount} отзывов
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === 'orders' && (
              <div className="p-6">
                {orders.length === 0 ? (
                  <div className="text-center py-12">
                    <Clock className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-500 dark:text-gray-400">Нет активных заказов</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {orders.map((order) => (
                      <div
                        key={order.id}
                        className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="font-semibold text-gray-900 dark:text-white">
                              {order.service.title}
                            </h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {order.isBuyer ? 'Продавец' : 'Покупатель'}: {order.otherUser.displayName}
                            </p>
                          </div>
                          <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                            order.status === 'pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' :
                            order.status === 'in_progress' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' :
                            order.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                            'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                          }`}>
                            {order.status === 'pending' ? 'Ожидание' :
                             order.status === 'in_progress' ? 'В работе' :
                             order.status === 'completed' ? 'Завершён' : 'Отменён'}
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                          <div className="flex items-center gap-1">
                           
                            <span>{order.price} бобров</span>
                          </div>
                          <span>•</span>
                          <span>{new Date(order.createdAt).toLocaleDateString('ru')}</span>
                        </div>
                        {order.status === 'in_progress' && order.isBuyer && (
                          <button
                            onClick={async () => {
                              try {
                                await api.post(`/marketplace/orders/${order.id}/complete`, {});
                                loadOrders();
                              } catch (error: any) {
                                alert(error.response?.data?.error || 'Ошибка');
                              }
                            }}
                            className="mt-3 w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                          >
                            <CheckCircle className="w-4 h-4 inline mr-2" />
                            Подтвердить выполнение
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Service Detail Modal */}
          <AnimatePresence>
            {selectedService && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/50 flex items-center justify-center p-4"
                onClick={() => setSelectedService(null)}
              >
                <motion.div
                  initial={{ scale: 0.95 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0.95 }}
                  className="w-full max-w-2xl bg-white dark:bg-gray-800 rounded-2xl overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  {selectedService.images[0] && (
                    <img
                      src={selectedService.images[0]}
                      alt={selectedService.title}
                      className="w-full h-64 object-cover"
                    />
                  )}
                  <div className="p-6">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                      {selectedService.title}
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                      {selectedService.description}
                    </p>
                    <div className="flex items-center gap-4 mb-6">
                      <img
                        src={selectedService.seller.avatar || '/default-avatar.png'}
                        alt={selectedService.seller.displayName}
                        className="w-12 h-12 rounded-full"
                      />
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {selectedService.seller.displayName}
                        </div>
                        <div className="text-sm text-gray-500">
                          <Star className="w-3 h-3 inline text-yellow-500 fill-yellow-500" />
                          {' '}{selectedService.seller.rating.toFixed(1)} • {selectedService.seller.completedOrders} заказов
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
                      <div className="flex items-center gap-2">
                       
                        <span className="text-2xl font-bold text-gray-900 dark:text-white">
                          {selectedService.price}
                        </span>
                      </div>
                      <button
                        onClick={() => handlePurchase(selectedService.id)}
                        className="px-6 py-3 bg-nexo-500 text-white rounded-lg hover:bg-nexo-600 transition-all font-medium"
                      >
                        Заказать
                      </button>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
