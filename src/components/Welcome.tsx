import React from 'react'

interface WelcomeProps {
  message?: string
}

export function Welcome({ message = 'Welcome to your React app!' }: WelcomeProps) {
  return (
    <div className="p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-semibold text-gray-800 mb-2">
        {message}
      </h2>
      <p className="text-gray-600">
        This is a sample component. Feel free to modify or delete it!
      </p>
    </div>
  )
}

export default Welcome