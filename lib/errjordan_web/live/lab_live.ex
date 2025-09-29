defmodule ErrjordanWeb.LabLive do
  use ErrjordanWeb, :live_view

  @impl true
  def mount(_params, _session, socket) do
    now = System.system_time(:millisecond)
    extent = %{start: now - days(30), end: now}
    view   = %{start: extent.start, end: extent.end}

    rows = demo_rows(extent)

    {:ok,
     socket
     |> assign(:rows, rows)
     |> assign(:extent, extent)
     |> assign(:view, view)
     |> assign(:sync_view?, true)}
  end

  # Optional: only used if you enable client→server push in the JS hook
  @impl true
  def handle_event("timeline:view_changed", %{"start" => s, "end" => e}, socket) do
    {:noreply, assign(socket, view: %{start: s, end: e})}
  end

  # helpers
  defp days(n), do: n * 24 * 60 * 60 * 1000
  defp minutes(n), do: n * 60 * 1000

  defp demo_rows(%{start: s, end: e}) do
    mid = s + div(e - s, 2)

    valve_a = %{
      id: "v-01",
      kind: "valve",
      label: %{serial: "SN-0001", name: "North Lawn"},
      spans: [
        %{start: s + minutes(90),  end: s + minutes(180), kind: "nominal"},
        %{start: mid + minutes(60), end: mid + minutes(120), kind: "confirmed"},
        %{start: e - minutes(240), end: e - minutes(200),  kind: "unexpected"}
      ]
    }

    valve_b = %{
      id: "v-02",
      kind: "valve",
      label: %{serial: "SN-0002", name: "Front Beds"},
      spans: [
        %{start: s + minutes(30),  end: s + minutes(60),  kind: "missing"},
        %{start: s + minutes(300), end: s + minutes(360), kind: "nominal"},
        %{start: mid + minutes(10), end: mid + minutes(40), kind: "unexpected"}
      ]
    }

    samples =
      for i <- 0..40 do
        t = s + div(i * (e - s), 40)
        y = :math.sin(i / 6) * 10 + 50 + :rand.uniform() * 2
        %{t: t, y: y}
      end

    gauge = %{
      id: "g-flow",
      kind: "gauge",
      label: %{serial: "GW-1001", name: "Main Flow"},
      sensor: "flow",
      samples: samples,
      gaps: [%{start: mid - minutes(120), end: mid - minutes(60)}]
    }

    [valve_a, valve_b, gauge]
  end
end
