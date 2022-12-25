import * as express from 'express';
import admin from 'firebase-admin';
import * as functions from 'firebase-functions';

interface TicketAvailabilityProps {
  allBooked: boolean;
  shifts: {
    morning: {
      allBooked: boolean;
      bookedSits: {
        '1': boolean;
        '2': boolean;
        '3': boolean;
        '4': boolean;
        '5': boolean;
      };
    };
    afternoon: {
      allBooked: boolean;
      bookedSits: {
        '1': boolean;
        '2': boolean;
        '3': boolean;
        '4': boolean;
        '5': boolean;
      };
    };
  };
}

interface BookTicketsDocProps {
  [ticketDate: string]: {
    ticketAvailability: TicketAvailabilityProps;
  };
}

interface BookTicketAvailabilityDatesProps {
  ticketDate: string;
  ticketAvailability: TicketAvailabilityProps;
}

interface BookTicketAvailabilityProps {
  codeDestination: string;
  ticketDates: BookTicketAvailabilityDatesProps[];
}

export const getTicketsAvailability = async (
  req: functions.https.Request,
  res: express.Response
) => {
  try {
    const bookTicketsCodeDstRef = admin.firestore().collection('bookTickets');

    const bookTicketCodeDstSnapshot = await bookTicketsCodeDstRef.get();

    if (bookTicketCodeDstSnapshot.empty) {
      res.json({
        status: 'success',
        data: [],
      });
    } else {
      const bookTicketAvailabilityData: BookTicketAvailabilityProps[] = [];

      bookTicketCodeDstSnapshot.forEach((doc) => {
        const bookTicketCodeDstDoc: BookTicketsDocProps = doc.data();
        const ticketDates: BookTicketAvailabilityDatesProps[] = [];

        for (const ticketDate in bookTicketCodeDstDoc) {
          if (
            Object.prototype.hasOwnProperty.call(
              bookTicketCodeDstDoc,
              ticketDate
            )
          ) {
            ticketDates.push({
              ticketDate,
              ticketAvailability:
                bookTicketCodeDstDoc[ticketDate].ticketAvailability,
            });
          }
        }

        bookTicketAvailabilityData.push({
          codeDestination: doc.id,
          ticketDates,
        });
      });

      res.json({
        status: 'success',
        data: bookTicketAvailabilityData,
      });
    }
  } catch (error) {
    res.status(500);
    res.json({
      status: 'failed',
    });
  }
};
