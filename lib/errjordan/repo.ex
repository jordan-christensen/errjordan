defmodule Errjordan.Repo do
  use Ecto.Repo,
    otp_app: :errjordan,
    adapter: Ecto.Adapters.Postgres
end
