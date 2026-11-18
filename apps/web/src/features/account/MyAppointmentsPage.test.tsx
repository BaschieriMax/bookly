import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { customerMe, demoAppointment, server } from '@/test/server'
import { renderApp } from '@/test/renderApp'

describe('MyAppointmentsPage', () => {
  it('lists upcoming appointments and cancels after confirmation', async () => {
    let cancelled = false
    server.use(
      http.get('/api/auth/me', () => HttpResponse.json(customerMe)),
      http.get('/api/me/appointments', () =>
        HttpResponse.json(
          cancelled
            ? [demoAppointment({ status: 'CancelledByCustomer', canCancel: false })]
            : [demoAppointment()],
        ),
      ),
      http.post('/api/me/appointments/:id/cancel', () => {
        cancelled = true
        return HttpResponse.json(
          demoAppointment({ status: 'CancelledByCustomer', canCancel: false }),
        )
      }),
    )
    renderApp('/account/appuntamenti')

    expect(await screen.findByText('Barberia Demo')).toBeInTheDocument()
    expect(screen.getByText('Confermato')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Disdici' }))
    const dialog = await screen.findByRole('alertdialog', { name: "Disdire l'appuntamento?" })
    expect(within(dialog).getByRole('button', { name: 'No, tienilo' })).toHaveFocus()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Sì, disdici' }))

    expect(await screen.findByText('Disdetto')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Disdici' })).not.toBeInTheDocument()
  })

  it('explains how to cancel when the online window has passed', async () => {
    server.use(
      http.get('/api/auth/me', () => HttpResponse.json(customerMe)),
      http.get('/api/me/appointments', () =>
        HttpResponse.json([demoAppointment({ canCancel: false })]),
      ),
    )
    renderApp('/account/appuntamenti')

    expect(await screen.findByText(/per disdire chiama l'attività/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '059 000 0000' })).toHaveAttribute(
      'href',
      'tel:0590000000',
    )
  })
})
