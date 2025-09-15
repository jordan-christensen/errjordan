defmodule ErrjordanWeb.DemoLive do
  use ErrjordanWeb, :live_view

  def mount(_params, _session, socket) do
    {:ok, assign(socket, :now, DateTime.utc_now())}
  end

  def render(assigns) do
    ~H"""
    <Layouts.app flash={@flash}>
      <div id="demo-live" class="space-y-6">
        <h1 class="text-2xl font-semibold">Demo LiveView</h1>
        <p class="text-base-content/70">Now: {@now}</p>

        <div id="hello-hook-target" phx-hook=".HelloHook" class="p-4 rounded border border-base-300">
          This box has phx-hook="HelloHook". Open the JS console to see it mount.
        </div>
      </div>
    </Layouts.app>
    """
  end
end
