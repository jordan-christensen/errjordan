defmodule ErrjordanWeb.HealthController do
  use ErrjordanWeb, :controller

  def show(conn, _params) do
    json(conn, %{status: "ok"})
  end
end

