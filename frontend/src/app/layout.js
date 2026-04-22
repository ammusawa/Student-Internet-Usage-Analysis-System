import './globals.css'

export const metadata = {
  title: 'Student Internet Usage Analysis',
  description: 'Monitor and analyze student internet proxy logs',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
