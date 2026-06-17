#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import nodemailer from "nodemailer";

const server = new McpServer({
  name: "mcp-email-sender",
  version: "1.0.0",
});

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "587", 10);
const SMTP_SECURE = String(process.env.SMTP_SECURE || "false").toLowerCase() === "true";
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER;
const SMTP_FROM_NAME = process.env.SMTP_FROM_NAME || "";

if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
  console.error("[mcp-email-sender] AVISO: variáveis SMTP_HOST, SMTP_USER e SMTP_PASS são obrigatórias.");
}

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_SECURE,
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
});

const buildFromAddress = (overrideFrom, overrideName) => {
  const address = overrideFrom || SMTP_FROM;
  const name = overrideName || SMTP_FROM_NAME;
  if (name) return `"${name}" <${address}>`;
  return address;
};

// ========================================
// Tool: Enviar Email
// ========================================

server.tool(
  "sendEmail",
  "Envia um email via SMTP usando nodemailer. Suporta destinatários múltiplos (separados por vírgula), CC, BCC, corpo em texto e/ou HTML.",
  {
    to: z.string().describe("Destinatário(s). Aceita múltiplos separados por vírgula. Ex: 'a@x.com, b@y.com'"),
    subject: z.string().describe("Assunto do email"),
    text: z.string().optional().describe("Corpo em texto puro (opcional se html for fornecido)"),
    html: z.string().optional().describe("Corpo em HTML (opcional se text for fornecido)"),
    cc: z.string().optional().describe("CC - cópia. Aceita múltiplos separados por vírgula"),
    bcc: z.string().optional().describe("BCC - cópia oculta. Aceita múltiplos separados por vírgula"),
    replyTo: z.string().optional().describe("Endereço para resposta (Reply-To)"),
    from: z.string().optional().describe("Sobrescreve o remetente padrão (SMTP_FROM)"),
    fromName: z.string().optional().describe("Nome de exibição do remetente"),
  },
  async ({ to, subject, text, html, cc, bcc, replyTo, from, fromName }) => {
    try {
      if (!text && !html) {
        return {
          content: [{ type: "text", text: JSON.stringify({ success: false, error: "É necessário informar 'text' ou 'html'." }, null, 2) }],
        };
      }

      const info = await transporter.sendMail({
        from: buildFromAddress(from, fromName),
        to,
        cc,
        bcc,
        replyTo,
        subject,
        text,
        html,
      });

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: true,
            messageId: info.messageId,
            accepted: info.accepted,
            rejected: info.rejected,
            response: info.response,
          }, null, 2),
        }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: JSON.stringify({ success: false, error: error.message }, null, 2) }],
      };
    }
  }
);

// ========================================
// Tool: Verificar conexão SMTP
// ========================================

server.tool(
  "verifySmtp",
  "Verifica se a conexão e autenticação com o servidor SMTP estão funcionando.",
  {},
  async () => {
    try {
      await transporter.verify();
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            success: true,
            host: SMTP_HOST,
            port: SMTP_PORT,
            secure: SMTP_SECURE,
            user: SMTP_USER,
          }, null, 2),
        }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: JSON.stringify({ success: false, error: error.message }, null, 2) }],
      };
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("MCP Email Sender rodando via STDIO...");
