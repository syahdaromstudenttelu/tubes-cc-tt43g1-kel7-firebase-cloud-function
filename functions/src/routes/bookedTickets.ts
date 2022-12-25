import cors from 'cors';
import * as functions from 'firebase-functions';
import { getUserBookedTickets } from './booked-tickets-handlers/getUserBookedTicket.js';

const corsApp = cors({
  origin: ['https://tubes-cc-tt43g1-kel7-web.vercel.app'],
});

export const bookedTickets = functions.https.onRequest((req, res) => {
  corsApp(req, res, async () => {
    if (req.method === 'GET') {
      await getUserBookedTickets(req, res);
    } else {
      res.status(400);
      res.json({
        status: 'failed',
        message: 'Invalid HTTP method',
      });
    }
  });
});
