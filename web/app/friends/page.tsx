"use client";

import { useEffect, useState } from "react";
import { UserNav } from "@/components/UserNav";
import {
  getFriends,
  updateFriendRequest,
  checkAuth,
} from "@/lib/api";
import type { User } from "@/lib/types";
import Link from "next/link";

export default function FriendsPage() {
  const [friends, setFriends] = useState<User[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    const loadFriends = async () => {
      try {
        const authStatus = await checkAuth();
        setAuthenticated(authStatus.authenticated);

        if (!authStatus.authenticated) {
          setLoading(false);
          return;
        }

        // Get friends and requests in parallel
        const [friendsData, requestsData] = await Promise.all([
          getFriends(),
          getFriends("requests"),
        ]);

        setFriends(friendsData.friends || []);
        setRequests(requestsData.requests || []);
      } catch (error) {
        console.error("Failed to load friends:", error);
      } finally {
        setLoading(false);
      }
    };

    loadFriends();
  }, []);

  const handleAccept = async (userId: string) => {
    try {
      await updateFriendRequest(userId, "accept");

      // Move from requests to friends
      const request = requests.find((r) => r.requester.id === userId);
      if (request) {
        setRequests(requests.filter((r) => r.requester.id !== userId));
        setFriends([...friends, request.requester]);
      }
    } catch (error) {
      console.error("Failed to accept request:", error);
    }
  };

  const handleReject = async (userId: string) => {
    try {
      await updateFriendRequest(userId, "reject");
      setRequests(requests.filter((r) => r.requester.id !== userId));
    } catch (error) {
      console.error("Failed to reject request:", error);
    }
  };

  return (
    <div className="min-h-screen p-6" style={{ backgroundColor: "var(--ln-bg)" }}>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold" style={{ color: "var(--ln-ink)" }}>
            Friends
          </h1>
          <UserNav />
        </div>

        {/* Not authenticated */}
        {!loading && !authenticated && (
          <div
            className="p-8 rounded-lg text-center"
            style={{
              backgroundColor: "var(--ln-surface)",
              color: "var(--ln-ink)",
            }}
          >
            <p className="text-lg mb-4">Login with Spotify to manage friends</p>
            <a
              href="/api/auth/spotify/login"
              className="inline-block px-6 py-3 rounded-lg font-medium transition-opacity hover:opacity-80"
              style={{
                backgroundColor: "var(--ln-accent)",
                color: "white",
              }}
            >
              Login with Spotify
            </a>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-12">
            <div
              className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: "var(--ln-accent)" }}
            />
          </div>
        )}

        {/* Friend Requests */}
        {!loading && authenticated && requests.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-xl font-bold" style={{ color: "var(--ln-ink)" }}>
              Friend Requests
            </h2>
            <div className="space-y-3">
              {requests.map((request) => (
                <div
                  key={request.id}
                  className="p-4 rounded-lg flex items-center justify-between"
                  style={{ backgroundColor: "var(--ln-surface)" }}
                >
                  <div className="flex items-center gap-3">
                    {request.requester.avatarUrl && (
                      <img
                        src={request.requester.avatarUrl}
                        alt={request.requester.displayName}
                        className="w-12 h-12 rounded-full"
                      />
                    )}
                    <div>
                      <div className="font-medium" style={{ color: "var(--ln-ink)" }}>
                        {request.requester.displayName}
                      </div>
                      <div className="text-sm" style={{ color: "var(--ln-ink-soft)" }}>
                        @{request.requester.handle}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAccept(request.requester.id)}
                      className="px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-80"
                      style={{
                        backgroundColor: "var(--ln-accent)",
                        color: "white",
                      }}
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => handleReject(request.requester.id)}
                      className="px-4 py-2 rounded-lg text-sm transition-opacity hover:opacity-80"
                      style={{
                        backgroundColor: "var(--ln-line)",
                        color: "var(--ln-ink-soft)",
                      }}
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Friends List */}
        {!loading && authenticated && (
          <div className="space-y-3">
            <h2 className="text-xl font-bold" style={{ color: "var(--ln-ink)" }}>
              Your Friends ({friends.length})
            </h2>
            {friends.length === 0 ? (
              <div
                className="p-8 rounded-lg text-center"
                style={{
                  backgroundColor: "var(--ln-surface)",
                  color: "var(--ln-ink-soft)",
                }}
              >
                <p>No friends yet. Search for users and add them!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {friends.map((friend) => (
                  <Link
                    key={friend.id}
                    href={`/profile/${friend.handle}`}
                    className="block p-4 rounded-lg transition-opacity hover:opacity-80"
                    style={{ backgroundColor: "var(--ln-surface)" }}
                  >
                    <div className="flex items-center gap-3">
                      {friend.avatarUrl && (
                        <img
                          src={friend.avatarUrl}
                          alt={friend.displayName}
                          className="w-12 h-12 rounded-full"
                        />
                      )}
                      <div>
                        <div className="font-medium" style={{ color: "var(--ln-ink)" }}>
                          {friend.displayName}
                        </div>
                        <div className="text-sm" style={{ color: "var(--ln-ink-soft)" }}>
                          @{friend.handle}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
