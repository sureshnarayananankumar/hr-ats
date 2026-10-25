import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { OffersService } from './offers.service';
import {
  CreateOfferDto,
  OfferApprovalDecisionDto,
  OfferQueryDto,
  RespondToOfferDto,
  SubmitOfferApprovalDto,
  UpdateOfferDto,
  WithdrawOfferDto,
} from './offers.dto';
import { AuthenticatedUser, CurrentUser, RequirePermissions } from '../../common/auth/decorators';
import { PERMISSIONS } from '../../common/auth/permissions';

@ApiTags('Offers')
@Controller('offers')
export class OffersController {
  constructor(private readonly offers: OffersService) {}

  @Get()
  @ApiOperation({
    summary: 'List offers',
    description:
      'HR sees everything. A candidate sees only their own sent offers -- ' +
      'never drafts or the internal approval chain.',
  })
  findAll(@Query() query: OfferQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.offers.findAll(query, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one offer' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.offers.findOne(id, user);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.OFFER_CREATE)
  @ApiOperation({ summary: 'Create an offer (saved as DRAFT)' })
  create(
    @Body() dto: CreateOfferDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.offers.create(dto, user, req.ip ?? 'unknown');
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.OFFER_UPDATE)
  @ApiOperation({ summary: 'Update offer terms (draft or pending approval only)' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOfferDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.offers.update(id, dto, user);
  }

  @Post(':id/submit')
  @RequirePermissions(PERMISSIONS.OFFER_UPDATE)
  @ApiOperation({ summary: 'Submit an offer for approval' })
  submit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmitOfferApprovalDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.offers.submitForApproval(id, dto.approverIds, user, req.ip ?? 'unknown');
  }

  @Post(':id/approval')
  @RequirePermissions(PERMISSIONS.OFFER_APPROVE)
  @ApiOperation({ summary: 'Approve or reject an offer' })
  decide(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: OfferApprovalDecisionDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.offers.decideApproval(id, dto.decision, dto.comments, user, req.ip ?? 'unknown');
  }

  @Post(':id/send')
  @RequirePermissions(PERMISSIONS.OFFER_SEND)
  @ApiOperation({
    summary: 'Send an approved offer to the candidate',
    description:
      'Moves the application to Offer Released. It does NOT mark the ' +
      'candidate as hired -- that requires acceptance and onboarding.',
  })
  send(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.offers.send(id, user, req.ip ?? 'unknown');
  }

  @Post(':id/respond')
  @RequirePermissions(PERMISSIONS.OFFER_RESPOND_OWN)
  @ApiOperation({ summary: 'Accept or decline your own offer' })
  respond(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RespondToOfferDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.offers.respond(id, dto, user, req.ip ?? 'unknown');
  }

  @Patch(':id/withdraw')
  @RequirePermissions(PERMISSIONS.OFFER_WITHDRAW)
  @ApiOperation({ summary: 'Withdraw an offer' })
  withdraw(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: WithdrawOfferDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.offers.withdraw(id, dto.reason, user, req.ip ?? 'unknown');
  }
}
