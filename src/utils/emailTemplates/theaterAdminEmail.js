const getTheaterAdminCredentialsTemplate = ({
  name,
  email,
  password
}) => {

  return `
<!DOCTYPE html>

<html>

<head>
  <meta charset="UTF-8">
  <title>
    Theater Admin Account
  </title>
</head>

<body>

  <h2>
    Welcome ${name}
  </h2>

  <p>
    Your Theater Admin account has been approved.
  </p>

  <p>
    You can now login using the following credentials:
  </p>

  <p>
    <strong>Email:</strong>
    ${email}
  </p>

  <p>
    <strong>Temporary Password:</strong>
    ${password}
  </p>

  <p>
    Please change your password after your first login.
  </p>

  <p>
    Regards,<br>
    Admin Team
  </p>

</body>

</html>
`;
};

module.exports = {
  getTheaterAdminCredentialsTemplate
};