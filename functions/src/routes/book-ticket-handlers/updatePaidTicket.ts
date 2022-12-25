import * as express from 'express';
import admin from 'firebase-admin';
import * as functions from 'firebase-functions';

type TicketShifts = 'morning' | 'afternoon';
type SitPos = '1' | '2' | '3' | '4' | '5';

interface FirebaseAuthError {
  code: string;
  message: string;
  name: string;
}

interface UserBookedTicketProps {
  ticketId: string;
  bookFrom: string;
  bookTo: string;
  bookDate: string;
  bookShift: TicketShifts;
  bookSitPos: SitPos;
  bookPassangerName: string;
  bookPassangerPhone: string;
  bookTotalPayment: number;
  paidOff: boolean;
}

interface UserBookedTicketsDocProps {
  [ticketId: string]: UserBookedTicketProps;
}

interface PaidTicketReqBodyProps {
  uidToken: string;
  ticketId: string;
}

export const updatePaidTicket = async (
  req: functions.https.Request,
  res: express.Response
) => {
  try {
    const { uidToken, ticketId }: PaidTicketReqBodyProps = req.body;
    const verifiedUser = await admin.auth().verifyIdToken(uidToken);

    const usersBookedTicketsRef = admin
      .firestore()
      .collection('usersBookedTickets')
      .doc(verifiedUser.uid);

    const userBookedTicketsSnapshot = await usersBookedTicketsRef.get();

    const userBookedTicketsData =
      userBookedTicketsSnapshot.data() as UserBookedTicketsDocProps;

    const updatedUserBookedTicket = {
      ...userBookedTicketsData,
    };

    for (const userBookedTicketId in updatedUserBookedTicket) {
      if (userBookedTicketId === ticketId) {
        updatedUserBookedTicket[userBookedTicketId].paidOff = true;
      }
    }

    await usersBookedTicketsRef.set(updatedUserBookedTicket, {
      merge: true,
    });

    res.status(200);
    res.json({
      status: 'success',
    });
  } catch (error) {
    if ((error as FirebaseAuthError).code === 'auth/argument-error') {
      res.statusCode = 401;
      res.json({
        status: 'failed',
        message: 'Invalid User Id Token',
      });
    }
  }
};
