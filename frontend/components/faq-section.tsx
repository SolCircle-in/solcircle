"use client"

import { motion } from "framer-motion"
import { useState } from "react"
import { ChevronDown } from "lucide-react"

const faqs = [
  {
    question: "What is SolCircle and how does it work?",
    answer:
      "SolCircle is a platform that allows groups of people to invest together on the Solana blockchain, directly from their Telegram chats. It combines group fund management, decentralized voting, and real-time portfolio tracking in one seamless experience.",
  },
  {
    question: "How do I start an investment group?",
    answer:
      "You can create a new investment group directly from our platform. Once created, you'll get a unique link to invite members to your group's private Telegram chat. All management and voting happens through our integrated Telegram bot.",
  },
  {
    question: "How is governance handled within a group?",
    answer:
      "All investment proposals and decisions are handled through a decentralized voting process. Any member can propose an investment, and the group votes on it. All votes are recorded on the Solana blockchain for full transparency and immutability.",
  },
  {
    question: "What are the fees for using SolCircle?",
    answer:
      "SolCircle charges a small percentage fee on successful investment profits. There are no upfront costs or subscription fees to create or join a group. We only make money when your group makes money.",
  },
  {
    question: "Is my group's capital secure?",
    answer:
      "Security is paramount. All funds are held in a multi-signature smart contract on the Solana blockchain. Funds can only be moved after a successful group vote, ensuring no single individual can control the assets.",
  },
  {
    question: "What kind of assets can we invest in?",
    answer:
      "Your group can invest in any token or digital asset available on the Solana blockchain. Our platform provides tools to research and propose investments in a wide range of projects.",
  },
  {
    question: "How does the Telegram integration work?",
    answer:
      "Our custom Telegram bot integrates directly into your group chat. You can use simple commands to view your portfolio, propose new investments, cast your vote, and see real-time analytics without ever leaving the Telegram app.",
  },
  {
    question: "What happens if a vote fails?",
    answer:
      "If a proposed investment does not meet the required voting threshold (e.g., a majority or super-majority, as defined by your group's rules), the proposal is rejected, and no funds are moved. The process is fully democratic and transparent.",
  },
]

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index)
  }

  return (
    <section id="faq" className="py-20 px-4 bg-black">
      <div className="container mx-auto max-w-4xl">
        <div className="text-center mb-16">
          <motion.h2
            className="text-4xl font-bold text-white mb-4"
            style={{ fontFamily: "var(--font-playfair)" }}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true, amount: 0.3 }}
          >
            Frequently Asked Questions
          </motion.h2>
          <motion.p
            className="text-xl text-foreground/80 max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            viewport={{ once: true, amount: 0.3 }}
          >
            Everything you need to know about SolCircle. Can't find what you're looking for? Contact our support team.
          </motion.p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <motion.div
              key={index}
              className="border border-border/20 rounded-lg bg-card/50 backdrop-blur-sm"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
            >
              <button
                className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-white/5 transition-colors rounded-lg"
                onClick={() => toggleFAQ(index)}
              >
                <span className="text-lg font-medium text-white pr-4">{faq.question}</span>
                <ChevronDown
                  className={`h-5 w-5 text-gray-400 transition-transform flex-shrink-0 ${
                    openIndex === index ? "rotate-180" : ""
                  }`}
                />
              </button>

              <motion.div
                initial={false}
                animate={{
                  height: openIndex === index ? "auto" : 0,
                  opacity: openIndex === index ? 1 : 0,
                }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <div className="px-6 pb-4">
                  <p className="text-gray-300 leading-relaxed">{faq.answer}</p>
                </div>
              </motion.div>
            </motion.div>
          ))}
        </div>

        <motion.div
          className="text-center mt-12"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          viewport={{ once: true }}
        >
          
          
        </motion.div>
      </div>
    </section>
  )
}