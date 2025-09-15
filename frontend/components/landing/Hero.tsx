'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { 
  ArrowRightIcon,
  GlobeAltIcon,
  ShieldCheckIcon,
  BoltIcon,
  CurrencyDollarIcon,
  MapPinIcon
} from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

export function Hero() {
  const features = [
    {
      icon: GlobeAltIcon,
      text: 'Global Payments',
    },
    {
      icon: ShieldCheckIcon,
      text: 'AI Security',
    },
    {
      icon: BoltIcon,
      text: 'Instant Transfers',
    },
    {
      icon: CurrencyDollarIcon,
      text: 'Multi-Currency',
    },
    {
      icon: MapPinIcon,
      text: 'Location-Based',
    },
  ];

  return (
    <section className="relative pt-20 pb-16 sm:pt-24 sm:pb-20 lg:pt-32 lg:pb-28">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900" />
      
      {/* Grid Pattern */}
      <div className="absolute inset-0 bg-grid-pattern opacity-5" />
      
      <div className="container-custom relative">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-8"
          >
            <Badge variant="primary" className="text-sm px-4 py-2">
              🚀 Now Available Globally
            </Badge>
          </motion.div>

          {/* Main Heading */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white mb-6"
          >
            Universal AI + Blockchain
            <span className="block text-gradient">Wallet</span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-xl sm:text-2xl text-gray-600 dark:text-gray-300 mb-8 max-w-3xl mx-auto leading-relaxed"
          >
            Send money globally with AI-powered security, automatic currency conversion, 
            and seamless blockchain integration. Works everywhere, anytime.
          </motion.p>

          {/* Feature Pills */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-wrap justify-center gap-3 mb-10"
          >
            {features.map((feature, index) => (
              <div
                key={index}
                className="flex items-center space-x-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-full px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                <feature.icon className="w-4 h-4 text-primary-600" />
                <span>{feature.text}</span>
              </div>
            ))}
          </motion.div>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12"
          >
            <Button size="lg" asChild className="group">
              <Link href="/auth/register">
                Get Started Free
                <ArrowRightIcon className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link href="#demo">
                Watch Demo
              </Link>
            </Button>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-2xl mx-auto"
          >
            <div className="text-center">
              <div className="text-3xl font-bold text-primary-600 dark:text-primary-400">
                50M+
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Transactions
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary-600 dark:text-primary-400">
                150+
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Countries
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary-600 dark:text-primary-400">
                99.9%
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Uptime
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary-600 dark:text-primary-400">
                $2B+
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Volume
              </div>
            </div>
          </motion.div>
        </div>

        {/* Hero Image/Animation */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="mt-16 relative"
        >
          <div className="relative max-w-4xl mx-auto">
            {/* Mockup Container */}
            <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              {/* Mockup Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                </div>
                <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  GlobalAi Payee
                </div>
                <div className="w-6"></div>
              </div>

              {/* Mockup Content */}
              <div className="p-8">
                <div className="space-y-6">
                  {/* Balance Card */}
                  <div className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-xl p-6 text-white">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <div className="text-sm opacity-90">Total Balance</div>
                        <div className="text-3xl font-bold">$12,450.00</div>
                      </div>
                      <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                        <CurrencyDollarIcon className="w-6 h-6" />
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>USD</span>
                      <span className="opacity-90">+2.5% today</span>
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 text-center">
                      <div className="w-8 h-8 bg-primary-100 dark:bg-primary-900 rounded-full flex items-center justify-center mx-auto mb-2">
                        <ArrowRightIcon className="w-4 h-4 text-primary-600" />
                      </div>
                      <div className="text-sm font-medium">Send</div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 text-center">
                      <div className="w-8 h-8 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-2">
                        <ArrowRightIcon className="w-4 h-4 text-green-600 rotate-180" />
                      </div>
                      <div className="text-sm font-medium">Receive</div>
                    </div>
                  </div>

                  {/* Recent Transactions */}
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                      Recent Transactions
                    </div>
                    <div className="space-y-3">
                      {[
                        { name: 'John Doe', amount: '+$250.00', time: '2 min ago', type: 'receive' },
                        { name: 'Coffee Shop', amount: '-$4.50', time: '1 hour ago', type: 'send' },
                        { name: 'Amazon', amount: '-$89.99', time: '3 hours ago', type: 'send' },
                      ].map((tx, index) => (
                        <div key={index} className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                              tx.type === 'receive' ? 'bg-green-100 dark:bg-green-900' : 'bg-gray-100 dark:bg-gray-700'
                            }`}>
                              <div className={`w-3 h-3 rounded-full ${
                                tx.type === 'receive' ? 'bg-green-600' : 'bg-gray-400'
                              }`}></div>
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-900 dark:text-white">
                                {tx.name}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {tx.time}
                              </div>
                            </div>
                          </div>
                          <div className={`text-sm font-medium ${
                            tx.type === 'receive' ? 'text-green-600' : 'text-gray-900 dark:text-white'
                          }`}>
                            {tx.amount}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating Elements */}
            <div className="absolute -top-4 -right-4 w-8 h-8 bg-primary-500 rounded-full animate-pulse"></div>
            <div className="absolute -bottom-4 -left-4 w-6 h-6 bg-green-500 rounded-full animate-pulse delay-1000"></div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}