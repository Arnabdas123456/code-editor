'use client';

import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Briefcase,
  Code,
  Zap,
  GitBranch,
  FileCode,
  Eye,
  Sparkles,
  Layers,
  Play,
  Rocket,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';
import Navbar from '@/components/navbar';
import Footer from '@/components/footer';
import AnimatedBackground from '@/components/animated-background';

const fadeInUp = {
  initial: { opacity: 0, y: 60 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6 },
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const features = [
  {
    icon: Sparkles,
    title: 'Build your idea with AI',
    description: 'Generate complete project structures from natural language descriptions',
  },
  {
    icon: GitBranch,
    title: 'Workflow Based Architecture',
    description: 'Structured workflows that break down complex projects into manageable tasks',
  },

  {
    icon: Eye,
    title: 'Live Code Preview',
    description: 'See your changes in real-time with instant preview updates',
  },
  {
    icon: Zap,
    title: 'Smart Prompt Editing',
    description: 'Refine and iterate on your code using conversational AI',
  },
];

const steps = [
  {
    number: '01',
    title: 'Describe your idea using prompts',
    description: 'Tell us what you want to build in plain English',
  },
  {
    number: '02',
    title: 'AI generates project structure',
    description: 'Watch as your project comes to life with complete architecture',
  },
  {
    number: '03',
    title: 'Edit, preview, and deploy',
    description: 'Refine your project and deploy instantly to production',
  },
];

export default function Home() {
  return (
    <div className="min-h-screen text-white">
      <AnimatedBackground />
      <Navbar />

      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial="initial"
            animate="animate"
            variants={staggerContainer}
            className="text-center"
          >
            <motion.div variants={fadeInUp} className="mb-6">
              <span className="inline-block px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-medium mb-6">
                AI-Powered Development Platform
              </span>
            </motion.div>

            <motion.h1
              variants={fadeInUp}
              className="text-5xl md:text-7xl font-bold mb-6 leading-tight"
            >
              Turn Ideas Into{' '}
              <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent animate-gradient">
                Production-Ready
              </span>
              <br />
              Software
            </motion.h1>

            <motion.p
              variants={fadeInUp}
              className="text-xl text-gray-400 mb-10 max-w-3xl mx-auto"
            >
              Describe your product in natural language. Our AI generates project structure, UI,
              and backend instantly.
            </motion.p>

            <motion.div
              variants={fadeInUp}
              className="flex flex-col sm:flex-row gap-4 justify-center"
            >
              <Button
                size="lg"
                className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all duration-300 hover:scale-105 text-lg px-8"
              >
                Start Building
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </motion.div>

            {/* <motion.div
              variants={fadeInUp}
              className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto"
            >
              {[1, 2, 3].map((i) => (
                <motion.div
                  key={i}
                  className="h-40 rounded-2xl bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-xl border border-white/10 p-4"
                  animate={{
                    y: [0, -10, 0],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    delay: i * 0.2,
                  }}
                >
                  <div className="h-full rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-white/5" />
                </motion.div>
              ))}
            </motion.div> */}
          </motion.div>
        </div>
      </section>

      <section id="roles" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-4">Choose Your Role</h2>
            <p className="text-gray-400 text-lg">Select how you want to build with AI</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              whileHover={{ y: -10 }}
              transition={{ duration: 0.3 }}
            >
              <Link href="/editor">
                <Card className="relative overflow-hidden p-8 bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-xl border-white/10 hover:border-blue-500/50 transition-all duration-300 cursor-pointer group h-full">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                  <div className="relative">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
                      <Briefcase className="w-8 h-8 text-white" />
                    </div>

                    <h3 className="text-2xl font-bold mb-4">Product Manager</h3>
                    <p className="text-gray-400 mb-6">
                      Describe product requirements. AI converts your ideas into structured
                      workflows, APIs, and UI tasks.
                    </p>

                    <Button className="w-full bg-blue-500 hover:bg-blue-600">
                      Start as Product Manager
                      <ArrowRight className="ml-2 w-4 h-4" />
                    </Button>
                  </div>
                </Card>
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              whileHover={{ y: -10 }}
              transition={{ duration: 0.3 }}
            >
              <Link href="/editor">
                <Card className="relative overflow-hidden p-8 bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-xl border-white/10 hover:border-purple-500/50 transition-all duration-300 cursor-pointer group h-full">
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-500/0 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                  <div className="relative">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
                      <Code className="w-8 h-8 text-white" />
                    </div>

                    <h3 className="text-2xl font-bold mb-4">Developer</h3>
                    <p className="text-gray-400 mb-6">
                      Generate frontend, backend, and full-stack code using AI suggestions.
                    </p>

                    <Button className="w-full bg-purple-500 hover:bg-purple-600">
                      Start as Developer
                      <ArrowRight className="ml-2 w-4 h-4" />
                    </Button>
                  </div>
                </Card>
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-4">Powerful Features</h2>
            <p className="text-gray-400 text-lg">Everything you need to build faster</p>
          </motion.div>

          <motion.div
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {features.map((feature, index) => (
              <motion.div key={index} variants={fadeInUp}>
                <Card className="p-6 bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-xl border-white/10 hover:border-white/20 transition-all duration-300 group hover:scale-105 h-full">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                    <feature.icon className="w-6 h-6 text-blue-400" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                  <p className="text-gray-400 text-sm">{feature.description}</p>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <section id="how-it-works" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-4">How It Works</h2>
            <p className="text-gray-400 text-lg">Three simple steps to transform your ideas</p>
          </motion.div>

          <div className="space-y-8">
            {steps.map((step, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.2 }}
                className="relative"
              >
                {index < steps.length - 1 && (
                  <div className="absolute left-12 top-24 w-0.5 h-20 bg-gradient-to-b from-blue-500 to-purple-500 opacity-50" />
                )}

                <Card className="p-8 bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-xl border-white/10 hover:border-white/20 transition-all duration-300 relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />

                  <div className="flex items-start gap-6">
                    <div className="flex-shrink-0 w-24 h-24 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-3xl font-bold">
                      {step.number}
                    </div>

                    <div className="flex-1 pt-2">
                      <h3 className="text-2xl font-bold mb-2">{step.title}</h3>
                      <p className="text-gray-400">{step.description}</p>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-12 text-center"
          >
            <Button
              size="lg"
              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all duration-300 hover:scale-105 text-lg px-8"
            >
              <Rocket className="mr-2 w-5 h-5" />
              Get Started Now
            </Button>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
}