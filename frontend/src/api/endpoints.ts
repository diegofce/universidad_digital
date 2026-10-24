export const endpoints = {
  auth: { login: '/auth/login', me: '/auth/me', logout: '/auth/logout' },
  users: '/users/',
  roles: '/users/roles',
  permissions: '/users/permissions',
  subjects: '/subjects/',
  periods: '/periods/',
  enrollments: '/enrollments/',
  grades: '/grades/',
} as const;
