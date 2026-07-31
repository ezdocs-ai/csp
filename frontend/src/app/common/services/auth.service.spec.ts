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

import {TestBed} from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import {Router} from '@angular/router';
import {Observable, of} from 'rxjs';
import {environment} from '../../../environments/environment';
import {AuthService} from './auth.service';
import {UserService} from './user.service';

interface AuthServiceInternals {
  promptForIdentityPlatformToken$: () => Observable<string>;
}

describe('AuthService', () => {
  let service: AuthService;
  let httpTestingController: HttpTestingController;
  let router: jasmine.SpyObj<Router>;

  beforeEach(() => {
    localStorage.clear();
    router = jasmine.createSpyObj<Router>('Router', [
      'navigate',
      'navigateByUrl',
    ]);
    Object.defineProperty(router, 'url', {value: '/login'});

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        AuthService,
        {provide: Router, useValue: router},
        {provide: UserService, useValue: {}},
      ],
    });
    service = TestBed.inject(AuthService);
    httpTestingController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTestingController.verify();
    localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should decode and store a Google base64url ID token', done => {
    const encodedPayload = 'eyJleHAiOjQxMDI0NDQ4MDAsIngiOiI-In0';
    const idToken = `header.${encodedPayload}.signature`;
    spyOn(
      service as unknown as AuthServiceInternals,
      'promptForIdentityPlatformToken$',
    ).and.returnValue(of(idToken));

    service.signInForGoogleIdentityPlatform().subscribe(token => {
      expect(token).toBe(idToken);
      expect(service.getToken()).toBe(idToken);
      done();
    });

    const request = httpTestingController.expectOne(
      `${environment.backendURL}/users/me`,
    );
    expect(request.request.headers.get('Authorization')).toBe(
      `Bearer ${idToken}`,
    );
    request.flush({roles: []});
  });

  it('should emit an error when the OIDC session is unavailable', done => {
    service.getValidIdentityPlatformToken$().subscribe({
      next: () => fail('Expected the token request to fail'),
      error: error => {
        expect(error.message).toBe('Your session has expired.');
        done();
      },
    });
  });
});
