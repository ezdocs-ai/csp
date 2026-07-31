/**
 * Copyright 2025 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {Injectable, PLATFORM_ID, inject} from '@angular/core';
import {Router} from '@angular/router';
import {UserModel, UserRolesEnum} from '../models/user.model';
import {HttpClient, HttpHeaders, HttpErrorResponse} from '@angular/common/http';
import {environment} from '../../../environments/environment';
import {UserService} from '../services/user.service';
import {EMPTY, Observable, throwError, of} from 'rxjs';
import {catchError, tap, map, switchMap} from 'rxjs/operators';
import {isPlatformBrowser} from '@angular/common';

// Declare the 'google' global object from the Google Identity Services script
declare const google: any;

const OIDC_SESSION_KEY = 'oidc_session';
const USER_DETAILS = 'USER_DETAILS';
const LOGIN_ROUTE = '/login';

function decodeJwtPayload(idToken: string): {exp: number} {
  const encodedPayload = idToken.split('.')[1];
  if (!encodedPayload) {
    throw new Error('Google Sign-In returned an invalid ID token.');
  }

  const base64 = encodedPayload.replace(/-/g, '+').replace(/_/g, '/');
  const paddedBase64 = base64.padEnd(
    base64.length + ((4 - (base64.length % 4)) % 4),
    '=',
  );
  const jsonPayload = decodeURIComponent(
    atob(paddedBase64)
      .split('')
      .map(
        character =>
          `%${character.charCodeAt(0).toString(16).padStart(2, '0')}`,
      )
      .join(''),
  );

  return JSON.parse(jsonPayload);
}

interface OidcSession {
  token: string;
  expiry: number;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private platformId = inject(PLATFORM_ID);

  private currentOAuthAccessToken: string | null = null;
  private oidcIdToken: string | null = null;
  private oidcTokenExpiry: number | null = null;

  constructor(
    private router: Router,
    private httpClient: HttpClient,
    private userService: UserService,
  ) {
    this.loadSessionFromStorage();
  }

  /**
   * A test sign-in method to get a Google ID token compatible with Identity Platform.
   *
   * @returns An Observable that emits the Identity Platform-compatible ID token.
   */
  signInForGoogleIdentityPlatform(): Observable<string> {
    return this.promptForIdentityPlatformToken$().pipe(
      switchMap(idToken => {
        const payload = decodeJwtPayload(idToken);
        this.oidcIdToken = idToken;
        this.oidcTokenExpiry = payload.exp * 1000;

        const session: OidcSession = {
          token: idToken,
          expiry: this.oidcTokenExpiry,
        };
        localStorage.setItem(OIDC_SESSION_KEY, JSON.stringify(session));

        // Call the backend to get or create the user profile.
        return this.syncUserWithBackend$(idToken).pipe(
          map(() => idToken), // Pass the token along for the final result.
        );
      }),
    );
  }

  private promptForIdentityPlatformToken$(): Observable<string> {
    const GOOGLE_CLIENT_ID = environment.GOOGLE_CLIENT_ID;

    return new Observable<string>(observer => {
      if (typeof google === 'undefined') {
        return observer.error(
          new Error(
            'Google Identity Services script not loaded. Add it to index.html',
          ),
        );
      }

      const loginTimeout = setTimeout(() => {
        observer.error(
          new Error(
            'Login timed out or third party sign-in may be disabled. Please try again and enable third party sign-in by clicking on the information button at the top left side of the browser.',
          ),
        );
      }, 15000);

      try {
        google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (response: any) => {
            clearTimeout(loginTimeout);
            const idToken = response.credential;
            if (idToken) {
              observer.next(idToken);
              observer.complete();
            } else {
              observer.error(
                new Error(
                  'Google Sign-In response did not contain a credential.',
                ),
              );
            }
          },
        });

        // Trigger the One Tap prompt.
        // Per new docs, we don't use the notification object for flow control.
        google.accounts.id.prompt();
      } catch (error) {
        clearTimeout(loginTimeout);
        console.error(
          'Error during Google Identity Platform sign-in initialization:',
          error,
        );
        observer.error(error);
      }
    });
  }

  /**
   * Gets the cached Google OIDC token when the current session is valid.
   * Expired or missing sessions require the user to sign in again.
   */
  getValidIdentityPlatformToken$(): Observable<string> {
    if (!isPlatformBrowser(this.platformId)) {
      return EMPTY;
    }

    if (!this.isLoggedIn()) {
      return throwError(() => new Error('Your session has expired.'));
    }

    return of(this.oidcIdToken!);
  }

  private syncUserWithBackend$(token: string): Observable<UserModel> {
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    return this.httpClient
      .get<UserModel>(`${environment.backendURL}/users/me`, {headers})
      .pipe(
        tap((userDetails: UserModel) => {
          // The backend is the source of truth. Save the returned profile to local storage.
          localStorage.setItem(USER_DETAILS, JSON.stringify(userDetails));
          console.log('User profile successfully synced with backend.');
        }),
        catchError((error: HttpErrorResponse) => {
          console.error('Failed to sync user with backend', error);
          // This is a critical error, so we should propagate it.
          return throwError(
            () =>
              new Error(
                error?.error?.detail ||
                  `Could not synchronize user profile with the server. ${error?.error?.detail}`,
              ),
          );
        }),
      );
  }

  async logout(route: string = LOGIN_ROUTE): Promise<void> {
    this.currentOAuthAccessToken = null;
    this.oidcIdToken = null;
    this.oidcTokenExpiry = null;
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem(OIDC_SESSION_KEY);
      localStorage.removeItem(USER_DETAILS);
      localStorage.removeItem('showTooltip');
      if (typeof google !== 'undefined') {
        google.accounts.id.disableAutoSelect();
      }
    }
    await this.router.navigateByUrl(route);
  }

  isLoggedIn() {
    if (!isPlatformBrowser(this.platformId)) return false;

    // Check if the in-memory token is valid
    const now = Date.now();
    const isTokenValid = !!(
      this.oidcIdToken &&
      this.oidcTokenExpiry &&
      this.oidcTokenExpiry > now
    );

    return isTokenValid;
  }

  private loadSessionFromStorage(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const sessionStr = localStorage.getItem(OIDC_SESSION_KEY);
    if (sessionStr) {
      const session: OidcSession = JSON.parse(sessionStr);
      // Check if the stored session is still valid
      if (session.expiry > Date.now()) {
        this.oidcIdToken = session.token;
        this.oidcTokenExpiry = session.expiry;
      } else {
        // If expired, remove it from storage.
        localStorage.removeItem(OIDC_SESSION_KEY);
      }
    }
  }

  isUserLoggedIn() {
    return this.isLoggedIn();
  }

  isUserAdmin() {
    if (!isPlatformBrowser(this.platformId)) return false;

    const user_role = this.userService.getUserDetails()?.roles;
    return user_role?.includes(UserRolesEnum.ADMIN) || false;
  }

  isUserWorkflows() {
    if (!isPlatformBrowser(this.platformId)) return false;

    const user_role = this.userService.getUserDetails()?.roles;
    return user_role?.includes(UserRolesEnum.WORKFLOWS) || false;
  }

  getToken() {
    return this.oidcIdToken;
  }

  setOAuthAccessToken(token: string | null): void {
    this.currentOAuthAccessToken = token;
  }

  getOAuthAccessToken(): string | null {
    // Renamed from getAccessToken for clarity
    return this.currentOAuthAccessToken;
  }

  /**
   * Retrieves the currently stored access token.
   */
  getAccessToken(): string | null {
    // Note: Tokens expire (usually after 1 hour).
    // A robust implementation would check expiry or refresh the token.
    // OAuth access token refresh requires re-authentication or a separate
    // authorization flow not covered here.
    // For a simple deploy button click, getting a fresh token on sign-in might suffice.
    return this.currentOAuthAccessToken;
  }
}
